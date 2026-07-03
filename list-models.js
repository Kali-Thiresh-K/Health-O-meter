import axios from 'axios';
import fs from 'fs';

const apiKey = "AIzaSyDxylVUxsqAxeX002jSDvLZ5XFIbQ7ZB_w";
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
