import {exec} from "child_process";
import fs from "fs";
import path from "path";
import {promisify} from "util";
import archiver from "archiver"; // Import archiver for zipping files

const ytDlpPath = path.join(process.cwd(), "app", "dep", "yt_dlp", "yt-dlp.exe");
const ffmpegPath = path.join(process.cwd(), "app", "dep", "ffmpeg", "ffmpeg.exe");

const execPromise = promisify(exec);
const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");
let isProcessing = false;

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, {recursive: true});
}

export async function POST(req) {
  if (isProcessing) {
    console.log('Server is busy processing another request.');
    return new Response(JSON.stringify({error: "Server is busy processing another request."}), {
      status: 429,
    });
  }
  
  isProcessing = true;
  const {youtubeUrl, timestamps} = await req.json();
  
  if (!youtubeUrl) {
    console.log('Missing YouTube URL or timestamps:', youtubeUrl, timestamps);
    isProcessing = false;
    return new Response(JSON.stringify({error: "Missing YouTube URL or timestamps."}), {
      status: 400,
    });
  }
  
  try {
    const videoId = new URL(youtubeUrl).searchParams.get("v");
    if (!videoId) {
      throw new Error("Invalid YouTube URL. No video ID found.");
    }
    const audioFile = path.join(DOWNLOADS_DIR, `${videoId}.mp3`);
    
    console.log(`Downloading audio from ${youtubeUrl}`);
    await execPromise(`${ytDlpPath} -x --audio-format mp3 -o "${audioFile}" "${youtubeUrl}"`);
    
    const timestampLines = timestamps?.split("\n").map((line) => line.trim()).filter(Boolean) || [];
    const extractedFiles = []; // ✅ Always initialize as an array
    
    const {stdout: ytDlpMetadata} = await execPromise(`${ytDlpPath} --get-duration "${youtubeUrl}"`);
    const videoDuration = ytDlpMetadata.trim(); // e.g., '00:25:17'
    
    const {stdout: title} = await execPromise(`${ytDlpPath} --get-title "${youtubeUrl}"`);
    const videoTitle = title.trim().replace(/\s+/g, "_").normalize("NFKD").replace(/[^\w.-]/g, "");
    
    if (timestampLines.length === 0) {
      const outputFile = path.join(DOWNLOADS_DIR, `${videoTitle}.mp3`);
      fs.renameSync(audioFile, outputFile); // ✅ Rename file instead of just defining the path
      extractedFiles.push({name: `${videoTitle}.mp3`});
    } else {
      for (let i = 0; i < timestampLines.length; i++) {
        const [start, ...titleParts] = timestampLines[i].split(" ");
        const clipTitle = titleParts.join(" ").replace(/[^a-zA-Z0-9]/g, "_");
        const nextStart = timestampLines[i + 1]?.split(" ")[0] || videoDuration;
        const end = `00:${nextStart}`;
        
        const formattedIndex = (i + 1).toString().padStart(2, "0");
        const outputFile = path.join(DOWNLOADS_DIR, `${formattedIndex}-${clipTitle}.mp3`);
        
        console.log(`Extracting segment: ${start} - ${end} as ${clipTitle}.mp3`);
        await execPromise(`${ffmpegPath} -i "${audioFile}" -ss 00:${start} -to ${end} -c copy "${outputFile}"`);
        
        extractedFiles.push({name: `${formattedIndex}-${clipTitle}.mp3`});
      }
    }
    
    // ✅ If no files, throw an error early
    if (extractedFiles.length === 0) {
      throw new Error("No extracted files found to zip.");
    }
    
    // ✅ Create a zip file
    const zipFilePath = path.join(DOWNLOADS_DIR, `${videoTitle}.zip`);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", {zlib: {level: 9}});
    
    output.on("close", () => {
      console.log(`Zipped file created: ${zipFilePath}`);
    });
    
    archive.on("error", (err) => {
      throw err;
    });
    
    archive.pipe(output);
    
    extractedFiles.forEach((file) => {
      const filePath = path.join(DOWNLOADS_DIR, file.name);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, {name: file.name});
      }
    });
    await archive.finalize();
    // ✅ Cleanup files after zipping
    setTimeout(() => {
      try {
        if (fs.existsSync(audioFile)) {
          fs.unlinkSync(audioFile);
        }
        extractedFiles.forEach((file) => {
          const filePath = path.join(DOWNLOADS_DIR, file.name);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }
        
        fs.unlinkSync(zipFilePath); // Optional: Delete the zip after some time
      } catch (err) {
        console.error("Error deleting files:", err);
      }
    }, 60000);
    
    isProcessing = false;
    return new Response(JSON.stringify({zip: `${videoTitle}.zip`, files: extractedFiles}), {status: 200});
  } catch (error) {
    console.error("Error during extraction:", error);
    isProcessing = false;
    return new Response(JSON.stringify({error: `Failed to process the request. ${error.message}`}), {status: 500});
  }
}
