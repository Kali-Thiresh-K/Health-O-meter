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
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function testGemini() {
    try {
        const response = await axios.get(apiUrl);
        const models = response.data.models.map(m => m.name);
        fs.writeFileSync('models.json', JSON.stringify(models, null, 2));
        console.log("Wrote models to models.json");
    } catch (error) {
        console.error("Error:", error.message);
    }
}

testGemini();
