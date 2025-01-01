import fs from 'fs';

export const deleteFile = (path) => {
    fs.unlinkSync(path, (err)=>{
        if(err) throw err;
        console.log('File deleted!');  // Delete the file
    });
}