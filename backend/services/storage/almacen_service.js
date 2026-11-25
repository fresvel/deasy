import { clienteAlmacen } from "./clienteAlmacen.js";

export const almacenClient = clienteAlmacen();

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
