# FFmpeg Audio Compression Guide

## Quick Commands for Hindi Audio Compression

### Option 1: Compress to MP3 (Recommended - Smallest Size)
```bash
ffmpeg -i input.mp3 -b:a 64k -ar 16000 -ac 1 output.mp3
```
- `-b:a 64k` - Bitrate: 64 kbps (good for speech, very small)
- `-ar 16000` - Sample rate: 16kHz (perfect for speech recognition)
- `-ac 1` - Mono channel (saves 50% space, speech doesn't need stereo)

**For your 21MB file, this should get it well under 19MB.**

### Option 2: More Quality (128k bitrate)
```bash
ffmpeg -i input.mp3 -b:a 128k -ar 22050 -ac 1 output.mp3
```
- Better quality, slightly larger file
- Still should be under 20MB for most files

### Option 3: Compress to OGG (Often Smaller Than MP3)
```bash
ffmpeg -i input.mp3 -b:a 64k -ar 16000 -ac 1 -c:a libvorbis output.ogg
```
- OGG Vorbis format, often smaller than MP3

### Option 4: Keep Original Format But Compress
```bash
# For M4A files
ffmpeg -i input.m4a -b:a 64k -ar 16000 -ac 1 -c:a aac output.m4a

# For WAV files (convert to MP3)
ffmpeg -i input.wav -b:a 64k -ar 16000 -ac 1 output.mp3
```

## Installation

### Windows
1. Download from: https://ffmpeg.org/download.html
2. Or use Chocolatey: `choco install ffmpeg`
3. Or use winget: `winget install ffmpeg`

### Mac
```bash
brew install ffmpeg
```

### Linux
```bash
sudo apt install ffmpeg  # Ubuntu/Debian
sudo yum install ffmpeg  # CentOS/RHEL
```

## Examples for Your Use Case

### Compress 21MB file to under 19MB:
```bash
ffmpeg -i your_file.mp3 -b:a 64k -ar 16000 -ac 1 compressed.mp3
```

### Check file size before/after:
```bash
# Windows PowerShell
Get-Item original.mp3 | Select-Object Length
Get-Item compressed.mp3 | Select-Object Length

# Or just check in File Explorer
```

### Batch compress multiple files:
```bash
# Windows PowerShell
Get-ChildItem *.mp3 | ForEach-Object {
    ffmpeg -i $_.Name -b:a 64k -ar 16000 -ac 1 "compressed_$($_.Name)"
}
```

## Bitrate Guide

| Bitrate | Quality | Use Case | File Size (per minute) |
|---------|---------|----------|------------------------|
| 32k | Low | Voice only, minimal | ~240KB |
| 64k | Good | Speech/interviews (RECOMMENDED) | ~480KB |
| 96k | Better | Speech with music | ~720KB |
| 128k | High | Music | ~960KB |

**For Hindi farmer interviews, 64k is perfect** - speech recognition works great at this quality.

## Sample Rate Guide

- **16kHz** - Perfect for speech (what we use)
- **22kHz** - Good for speech
- **44.1kHz** - Music quality (unnecessary for speech)

## Why These Settings?

1. **64k bitrate** - Speech is clear, file is small
2. **16kHz sample rate** - Speech recognition works perfectly at this rate
3. **Mono** - Speech doesn't need stereo, saves 50% space

## Quick Test

Test on a small file first:
```bash
# Compress a test file
ffmpeg -i test.mp3 -b:a 64k -ar 16000 -ac 1 test_compressed.mp3

# Check the size difference
# If it's good, use the same command on your 21MB file
```

## Expected Results

For a 21MB Hindi interview file:
- **Original**: ~21MB
- **Compressed (64k, 16kHz, mono)**: ~5-10MB (depending on length)
- **Result**: Well under 19MB ✅

## Troubleshooting

### "ffmpeg not found"
- Make sure FFmpeg is installed and in your PATH
- Restart terminal after installation

### "Permission denied"
- Make sure you have write permissions in the directory
- Try running as administrator (Windows) or with sudo (Mac/Linux)

### File still too large
- Try even lower bitrate: `-b:a 48k`
- Or reduce sample rate further: `-ar 11025` (minimum for speech)

