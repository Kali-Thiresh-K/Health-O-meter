import axios from 'axios';
import fs from 'fs';

function getApiKey() {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    try {
        const env = fs.readFileSync('.env', 'utf8');
        const match = env.match(/VITE_GEMINI_API_KEY=["']?([^"'\s]+)["']?/);
        if (match) return match[1];
    } catch (e) {}
    try {
        const env = fs.readFileSync('backend/.env', 'utf8');
        const match = env.match(/GEMINI_API_KEY=["']?([^"'\s]+)["']?/);
        if (match) return match[1];
    } catch (e) {}
    return '';
}

const apiKey = getApiKey();
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

async function testGemini() {
    try {
        const response = await axios.post(apiUrl, {
            contents: [{
                parts: [
                    { text: "Identify the food in this image. return only the name." },
                    { inlineData: { mimeType: "image/jpeg", data: "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=" } }
                ]
            }]
        });
        console.log("Success! Replaced 404 with 200 OK.");
    } catch (error) {
        console.error("Error:");
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testGemini();
