const fs = require('fs')
const path = require('path')
const os = require('os');
const crypto = require('crypto')
const { rimrafSync } = require('rimraf')
const { createCanvas, loadImage } = require('canvas')
const parseAPNG = require('apng-js').default
const { spawnSync } = require('child_process')

async function converter(inputBuffer, ffmpegFormat, options = {}) {
    const { tempPath = os.tmpdir(), ffmpegPath = 'ffmpeg', ffprobePath = 'ffprobe', skipInfo } = options
    const apng = parseAPNG(inputBuffer);
    if (apng instanceof Error) {
        throw apng
    }
    let isVfr = false
    const firstFrame = apng.frames[0]
    for(const i in apng.frames) {
        if(apng.frames[i].delay !== firstFrame.delay) {
            isVfr = true
            break
        }
    }
    const md5 = crypto.createHash('md5')
    const tempFilePath = path.join(tempPath, `${md5.update(inputBuffer).digest('hex')}_${Date.now()}`)
    fs.mkdirSync(tempFilePath)
    let inputText = ''
    const inputFilePath = path.join(tempFilePath, `input.txt`)
    const canvas = createCanvas(apng.width, apng.height)
    const ctx = canvas.getContext('2d')
    let prevFrame
    let prevFrameData
    for (const index in apng.frames) {
        const item = apng.frames[index]
        if (prevFrame && prevFrame.disposeOp == 1) {
            ctx.clearRect(prevFrame.left, prevFrame.top, prevFrame.width, prevFrame.height);
        } else if (prevFrame && prevFrame.disposeOp == 2) {
            ctx.putImageData(prevFrameData, prevFrame.left, prevFrame.top);
        }
        prevFrame = item;
        prevFrameData = null;
        if (item.disposeOp == 2) {
            prevFrameData = ctx.getImageData(item.left, item.top, item.width, item.height);
        }
        if(item.blendOp === 0) {
            ctx.clearRect(item.left, item.top, item.width, item.height)
        }
        let imgBuffer = Buffer.from(await item.imageData.arrayBuffer())
        const image = await loadImage(imgBuffer)
        ctx.drawImage(image, item.left, item.top)
        imgBuffer = canvas.toBuffer()
        const tempImgPath = path.resolve(tempFilePath, `${index}.png`)
        fs.writeFileSync(tempImgPath, imgBuffer)
        inputText += `file '${tempImgPath}'\nduration ${item.delay}ms\n`
        // ffmpeg concat last image duration incorrect fixed
        if(isVfr && index == apng.frames.length - 1) {
            inputText += `file '${tempImgPath}'\n`
        }
    }
    const outputPath = path.join(tempFilePath, `video.${ffmpegFormat.extname}`)
    let result
    if(isVfr) {
        fs.writeFileSync(inputFilePath, inputText, 'utf-8')
        result = spawnSync(ffmpegPath, ['-vsync', 'passthrough', '-y', '-safe', 0, '-f', 'concat', '-i', inputFilePath, '-c:v', ...ffmpegFormat.command, outputPath])
    } else {
        result = spawnSync(ffmpegPath, ['-framerate', `1000/${firstFrame.delay}`, '-y', '-i', path.join(tempFilePath, `%d.png`), '-c:v', ...ffmpegFormat.command, outputPath])
    }
    if (result.status != 0) {
        throw new Error(result.stderr.toString())
    }
    const outputBuffer = fs.readFileSync(outputPath)
    let data = {
        file: outputBuffer,
    }
    if(!skipInfo) {
        const ffprobeDuration = spawnSync(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', '-i', outputPath])
        const ffprobeFrames = spawnSync(ffprobePath, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'default=noprint_wrappers=1:nokey=1', '-i', outputPath])
        data = {
            ...data,
            apng: {
                width: apng.width,
                height: apng.height,
                duration: apng.playTime,
                frames: apng.frames.length,
            },
            video: {
                duration: ffprobeDuration.status === 0 ? Number(ffprobeDuration.stdout.toString().replace('/r/n', '')) * 1000 : null,
                frames: ffprobeFrames.status === 0 ? Number(ffprobeFrames.stdout.toString().replace('/r/n', '')) : null,
                vfr: isVfr,
            }
        }
    }
    rimrafSync(tempFilePath, { preserveRoot: false })
    return data
}

module.exports = converter