const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const crypto = require("crypto");

exports.sign = async (data) => {

  const jobId = crypto.randomUUID();

  const tempDir = "/dev/shm/sign-" + jobId;

  fs.mkdirSync(tempDir, { recursive: true });

  console.log("Working directory:", tempDir);

  return {
    jobId
  };

};