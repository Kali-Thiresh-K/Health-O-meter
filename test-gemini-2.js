import axios from 'axios';

const apiKey = "AIzaSyDxylVUxsqAxeX002jSDvLZ5XFIbQ7ZB_w";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
