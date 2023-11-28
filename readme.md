# apng2video
把apng动图转成视频，依赖ffmpeg

## 安装依赖
```bash
npm i -s apng2video
```
### canvas 因网络问题安装失败的解决办法
```bash
npm install canvas --canvas_binary_host_mirror=https://registry.npmmirror.com/-/binary/canvas
```

## 使用
```javascript
const apng2video = require('apng2video')
const fs = require('fs')

async function main() {
    const chip = fs.readFileSync('./chip.png')
    const video = await apng2video(
        chip, // 文件buffer
        { command: ['libvpx-vp9', '-lossless', 1], extname: 'webm' }, // command 为 ffmpeg 末尾定义需要转换的格式；extname是文件的扩展名
        { ffmpegPath: 'ffmpeg.exe', tempPath: './temp' } // ffmpeg 如果配置了全局变量了，则可以不配置路径；tempPath 可以不配置
    )
    fs.writeFileSync('./test.webm', video.file)
}

main()
```

## 兼容性

ffmpeg < 5.1