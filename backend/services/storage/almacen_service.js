import * as Minio from "minio";

const almacenUrl = new URL(process.env.ALMACEN_ENDPOINT || "http://almacen:9000");
const useSSL =
  String(process.env.ALMACEN_USE_SSL || "").trim() === "1" ||
  almacenUrl.protocol === "https:";

export const almacenClient = new Minio.Client({
  endPoint: almacenUrl.hostname,
  port: Number(almacenUrl.port || (useSSL ? 443 : 80)),
  useSSL,
  accessKey: process.env.ALMACEN_ACCESS_KEY || process.env.ALMACEN_ROOT_USER || "",
  secretKey: process.env.ALMACEN_SECRET_KEY || process.env.ALMACEN_ROOT_PASSWORD || ""
});

export const ensureBucketExists = (bucket) =>
  new Promise((resolve, reject) => {
    almacenClient.bucketExists(bucket, (error, exists) => {
      if (error) {
        reject(error);
        return;
      }
      if (exists) {
        resolve(true);
        return;
      }
      almacenClient.makeBucket(bucket, "", (makeError) => {
        if (makeError) {
          reject(makeError);
          return;
        }
        resolve(true);
      });
    });
  });

export const uploadFileToAlmacen = (bucket, objectName, filePath, meta = {}) =>
  new Promise((resolve, reject) => {
    almacenClient.fPutObject(bucket, objectName, filePath, meta, (error, etag) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(etag);
    });
  });

export const removeAlmacenObject = (bucket, objectName) =>
  new Promise((resolve, reject) => {
    almacenClient.removeObject(bucket, objectName, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(true);
    });
  });

export const statAlmacenObject = (bucket, objectName) =>
  new Promise((resolve, reject) => {
    almacenClient.statObject(bucket, objectName, (error, stat) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stat);
    });
  });

export const getAlmacenObjectStream = (bucket, objectName) =>
  new Promise((resolve, reject) => {
    almacenClient.getObject(bucket, objectName, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stream);
    });
  });
