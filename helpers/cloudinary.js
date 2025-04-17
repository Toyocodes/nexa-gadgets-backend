const cloudinary = require("cloudinary").v2;
const multer = require("multer");

//use this if you want to use env variables
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

//use this if you want to use hardcoded values on locals
// cloudinary.config({
//   cloud_name: "toyjad",
//   api_key: "921119243996337",
//   api_secret: "1SfPtHsbjAAUHFskKAkMtG-L3WA",
// });

// console.log("Cloudinary API Key:", cloudinary.config().api_key);

// console.log("Cloudinary Config:", {
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });


const storage = new multer.memoryStorage();

async function imageUploadUtil(file) {
  const result = await cloudinary.uploader.upload(file, {
    resource_type: "image",
  });

  return result;
}

const upload = multer({ storage });

module.exports = { upload, imageUploadUtil };
