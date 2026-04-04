import * as Minio from "minio";

const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://minio:9000");
const useSSL =
  String(process.env.MINIO_USE_SSL || "").trim() === "1" ||
  minioUrl.protocol === "https:";

export const minioClient = new Minio.Client({
  endPoint: minioUrl.hostname,
  port: Number(minioUrl.port || (useSSL ? 443 : 80)),
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "",
  secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || "",
});

export const ensureBucketExists = (bucket) =>
  new Promise((resolve, reject) => {
    minioClient.bucketExists(bucket, (error, exists) => {
      if (error) {
        reject(error);
        return;
      }
      if (exists) {
        resolve(true);
        return;
      }
      minioClient.makeBucket(bucket, "", (makeError) => {
        if (makeError) {
          reject(makeError);
          return;
        }
        resolve(true);
      });
    });
  });

export const uploadFileToMinio = (bucket, objectName, filePath, meta = {}) =>
  new Promise((resolve, reject) => {
    minioClient.fPutObject(bucket, objectName, filePath, meta, (error, uploadInfo) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(uploadInfo);
    });
  });

export const getMinioObjectStream = (bucket, objectName) =>
  new Promise((resolve, reject) => {
    minioClient.getObject(bucket, objectName, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stream);
    });
  });

export const listMinioObjects = (bucket, prefix = "", recursive = true) =>
  new Promise((resolve, reject) => {
    const objects = [];
    const stream = minioClient.listObjectsV2(bucket, prefix, recursive);
    stream.on("data", (item) => {
      if (item?.name) {
        objects.push(item.name);
      }
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(objects));
  });

export const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });

export const readMinioObjectAsText = async (bucket, objectName) => {
  const stream = await getMinioObjectStream(bucket, objectName);
  const buffer = await streamToBuffer(stream);
  return buffer.toString("utf8");
};
