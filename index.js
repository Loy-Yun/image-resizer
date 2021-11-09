const async = require('async');
const AWS = require('aws-sdk');
const sharp = require('sharp');

const s3 = new AWS.S3();

exports.handler = function(event, context, callback) {

  // 이벤트를 발생시킨 버킷 이름 & 객체 키 값
  let srcBucket = event.Records[0].s3.bucket.name;
  let srcKey    = event.Records[0].s3.object.key;
  // 저장할 버킷 & 키 값
  let dstBucket = srcBucket;
  let dstKey    = srcKey.replace(/origin/g, 'w200');

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

  async.waterfall([
    // 이미지 가져오기
      function download(next) {
        s3.getObject({
            Bucket: srcBucket,
            Key: srcKey
          },
          next);
      },
    // 이미지 리사이징
      function transform(response, next) {
        sharp(response.Body)
          .resize({width: 200}) // 사이즈: 가로 200
          .withMetadata()	// 이미지 exif 데이터 유지
          .toBuffer(function(err, buffer) {
            if (err) {
              next(err);
            } else {
              next(null, response.ContentType, buffer);
            }
          });
      },
    // 결과물 업로드
      function upload(contentType, data, next) {
        s3.putObject({
            Bucket: dstBucket,
            Key: dstKey,
            Body: data,
            ContentType: contentType,
            ACL: 'public-read'
          },
          next);
      }
    ], function (err) {
      if (err) {
        console.error(
          'Unable to resize ' + srcBucket + '/' + srcKey +
          ' and upload to ' + dstBucket + '/' + dstKey +
          ' due to an error: ' + err
        );
      } else {
        console.log(
          'Successfully resized ' + srcBucket + '/' + srcKey +
          ' and uploaded to ' + dstBucket + '/' + dstKey
        );
      }
      callback(null, "message");
    }
  );
};
