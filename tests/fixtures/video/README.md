# Video location fixtures (B1-T23)

Tiny real clips (64x112, 0.5 s, H.264 + AAC, or VP9 for WebM) that each carry a location in one of the forms a camera roll uses. The location is always 40.7128 N, 74.0060 W, 10 m. The domain, client, server and e2e tests use them.

| File | Location form | moov |
|---|---|---|
| `clean.mp4` | none | before mdat |
| `xyz-faststart.mov` | QuickTime `moov/udta/©xyz` | before mdat |
| `xyz-moov-at-end.mov` | QuickTime `moov/udta/©xyz` | after mdat |
| `ilst-xyz.mp4` | iTunes item `moov/udta/meta/ilst/©xyz` | before mdat |
| `keys-moov-meta.mov` | Apple keys in `moov/meta` (the iPhone layout): `com.apple.quicktime.location.ISO6709` | before mdat |
| `keys-udta-loci-faststart.mp4` | keys in `moov/udta/meta` (`…location.ISO6709` and `location`), plus 3GPP `loci` | before mdat |
| `keys-udta-moov-at-end.mov` | keys in `moov/udta/meta` (`…location.ISO6709`) | after mdat |
| `xmp-gps.mp4` | XMP `exif:GPSLatitude`/`GPSLongitude` in a top-level `uuid` box | before mdat |
| `tagged-location.webm` | Matroska SimpleTag `LOCATION` | n/a |

## How they were made

```sh
SRC="-f lavfi -i testsrc2=size=64x112:rate=15 -f lavfi -i sine=f=440:sample_rate=22050 -t 0.5 \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 32k -ac 1 -fflags +bitexact"
GEO="+40.7128-074.0060+010.000/"

ffmpeg $SRC -map_metadata -1 -flags:v +bitexact -flags:a +bitexact -movflags +faststart clean.mp4
ffmpeg $SRC -metadata "location=$GEO" -movflags +faststart -f mov xyz-faststart.mov
ffmpeg $SRC -metadata "location=$GEO" -f mov xyz-moov-at-end.mov
cp clean.mp4 ilst-xyz.mp4 && exiftool -overwrite_original '-ItemList:GPSCoordinates=40.7128, -74.0060, 10' ilst-xyz.mp4
ffmpeg $SRC -movflags +faststart -f mov keys-moov-meta.mov \
  && exiftool -overwrite_original '-Keys:GPSCoordinates=40.7128, -74.0060, 10' keys-moov-meta.mov
ffmpeg $SRC -metadata "com.apple.quicktime.location.ISO6709=$GEO" -metadata "location=$GEO" \
  -movflags +faststart+use_metadata_tags keys-udta-loci-faststart.mp4
ffmpeg $SRC -metadata "com.apple.quicktime.location.ISO6709=$GEO" -movflags use_metadata_tags -f mov keys-udta-moov-at-end.mov
cp clean.mp4 xmp-gps.mp4 && exiftool -overwrite_original -XMP:GPSLatitude=40.7128 -XMP:GPSLongitude=74.0060 xmp-gps.mp4
ffmpeg -f lavfi -i testsrc2=size=64x112:rate=15 -t 0.5 -c:v libvpx-vp9 -b:v 50k -an -metadata "location=$GEO" tagged-location.webm
```

Check a file with `exiftool -G1 -s -GPS:all -GPSCoordinates -Location <file>` (no output means no location) and `ffprobe -v error <file>` (no output means it reads cleanly).
