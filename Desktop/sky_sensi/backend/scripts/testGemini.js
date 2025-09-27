require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('🧪 Testing Gemini 2.0 Flash API...');
console.log('API Key:', process.env.GEMINI_API_KEY ? 'Present ✓' : 'Missing ❌');
console.log('Model:', process.env.GEMINI_MODEL || 'gemini-2.0-flash');

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
});

async function test() {
  try {
    console.log('Sending test prompt...');
    const result = await model.generateContent('Respond with only: GEMINI_2_FLASH_WORKING');
    const response = result.response.text().trim();

    if (response.includes('GEMINI_2_FLASH_WORKING')) {
      console.log('✅ Gemini 2.0 Flash API test SUCCESSFUL!');
      console.log('Response:', response);
    } else {
      console.log('⚠️ API responded but unexpected output:', response);
    }
  } catch (error) {
    console.error('❌ Gemini 2.0 Flash API test FAILED:');
    console.error('Error:', error.message);
  }
}

test();
