const async = require('async');
const AWS = require('aws-sdk');
const sharp = require('sharp');

const s3 = new AWS.S3();
const transforms = [
  { name: "s200", size: 200 },
  { name: "s400", size: 400 },
  { name: "s600", size: 600 }
];

exports.handler = async (event, context, callback) => {

  // 이벤트를 발생시킨 버킷 이름 & 객체 키 값
  let srcBucket = event.Records[0].s3.bucket.name;
  let srcKey    = event.Records[0].s3.object.key;
  // 저장할 버킷 & 키 값
  let dstBucket = srcBucket;
  // let dstKey    = srcKey.replace(/origin/g, 'w200');

  // 이미지 타입 예외처리
  var typeMatch = srcKey.match(/\.([^.]*)$/);
  if (!typeMatch) {
    callback("Could not determine the image type.");
    return;
  }
  var imageType = typeMatch[1];
  // jpg, png 만 취급
  if (imageType !== "jpg" && imageType !== "png") {
    callback('Unsupported image type: ${imageType}');
    return;
  }

  try {
    const image = await s3.getObject({ Bucket: srcBucket, Key: srcKey }).promise();

    await Promise.all(
      transforms.map(async item => {
        let dstKey = srcKey.replace(/origin/g, item.name);

        const resizeWidth = await sharp(image.Body).metadata().then(function(metadata) {
          let imgHeight = metadata.height; //이미지 높이
          let imgWidth = metadata.width; //이미지 넓이

          let scalingFactor = Math.max(
            item.size / imgWidth,
            item.size / imgHeight
          );
          return Math.floor(scalingFactor * imgWidth);
        });

        console.log(dstKey,' resize width ',resizeWidth)

        const resizedImg = await sharp(image.Body)
          .resize({ width: resizeWidth })
          .toFormat("png")
          .png({ quality: 100 })
          .toBuffer();
        return await s3
          .putObject({
            Bucket: dstBucket,
            Body: resizedImg,
            Key: dstKey,
            ACL: 'public-read'
          })
          .promise();
      })
    );
    callback(null, `Success: ${srcKey}`);
  } catch (err) {
    callback(`Error resizing files: ${err}`);
  }
};
