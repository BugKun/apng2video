const fs = require('fs')
const path = require('path')
const os = require('os');
const crypto = require('crypto')
const { rimrafSync } = require('rimraf')
const { createCanvas, loadImage } = require('canvas')
const parseAPNG = require('apng-js').default
const { spawnSync } = require('child_process')

async function converter(inputBuffer, ffmpegFormat, options = {}) {
    const { tempPath = os.tmpdir(), ffmpegPath = 'ffmpeg' } = options
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
    for (const index in apng.frames) {
        const item = apng.frames[index]
        let imgBuffer = Buffer.from(await item.imageData.arrayBuffer())
        if(apng.width !== item.width || apng.height != item.height || item.top !== 0 || item.left !== 0) {
            const canvas = createCanvas(apng.width, apng.height)
            const ctx = canvas.getContext('2d')
            const image = await loadImage(imgBuffer)
            ctx.drawImage(image, item.left, item.top)
            imgBuffer = canvas.toBuffer()
        }
        fs.writeFileSync(path.join(tempFilePath, `${index}.png`), imgBuffer)
        inputText += `file '${path.resolve(tempFilePath, index)}.png'\nduration ${item.delay}ms\n`
    }
    const outputPath = path.join(tempFilePath, `video.${ffmpegFormat.extname}`)
    let result
    if(isVfr) {
        fs.writeFileSync(inputFilePath, inputText, 'utf-8')
        result = spawnSync(ffmpegPath, ['-vsync', `vfr`, '-y', '-safe', 0, '-f', 'concat', '-i', inputFilePath, '-c:v', ...ffmpegFormat.command, outputPath])
    } else {
        result = spawnSync(ffmpegPath, ['-framerate', `1000/${firstFrame.delay}`, '-y', '-i', path.join(tempFilePath, `%d.png`), '-c:v', ...ffmpegFormat.command, outputPath])
    }
    if (result.status != 0) {
        throw new Error(result.stderr.toString())
    }
    const outputBuffer = fs.readFileSync(outputPath)
    rimrafSync(tempFilePath, { preserveRoot: false })
    return {
        file: outputBuffer,
        width: apng.width,
        height: apng.height,
        duration: apng.playTime,
        frames: apng.frames.length,
        vfr: isVfr,
    }
}

module.exports = converter