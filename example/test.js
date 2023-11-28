const fs = require('fs')
const apng2video = require('../index')

async function main() {
    const chip = fs.readFileSync('./chip.png')
    const video = await apng2video(
        chip,
        { command: ['libvpx-vp9', '-lossless', 1], extname: 'webm' },
        // { ffmpegPath: 'ffmpeg', tempPath: './temp' }
    )
    console.log(video)
    fs.writeFileSync('./test.webm', video.file)
}

main()