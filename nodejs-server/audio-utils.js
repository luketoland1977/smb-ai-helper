// Audio conversion utilities for Twilio <-> OpenAI compatibility

function mulawToPcm16(mulawData) {
  const pcm16Data = new Int16Array(mulawData.length);
  const mulawToLinear = [
    -32124,-31100,-30076,-29052,-28028,-27004,-25980,-24956,
    -23932,-22908,-21884,-20860,-19836,-18812,-17788,-16764,
    -15996,-15484,-14972,-14460,-13948,-13436,-12924,-12412,
    -11900,-11388,-10876,-10364, -9852, -9340, -8828, -8316,
     -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
     -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
     -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
     -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
     -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
     -1372, -1308, -1244, -1180, -1116, -1052,  -988,  -924,
      -876,  -844,  -812,  -780,  -748,  -716,  -684,  -652,
      -620,  -588,  -556,  -524,  -492,  -460,  -428,  -396,
      -372,  -356,  -340,  -324,  -308,  -292,  -276,  -260,
      -244,  -228,  -212,  -196,  -180,  -164,  -148,  -132,
      -120,  -112,  -104,   -96,   -88,   -80,   -72,   -64,
       -56,   -48,   -40,   -32,   -24,   -16,    -8,     0,
     32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
     23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
     15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
     11900, 11388, 10876, 10364,  9852,  9340,  8828,  8316,
      7932,  7676,  7420,  7164,  6908,  6652,  6396,  6140,
      5884,  5628,  5372,  5116,  4860,  4604,  4348,  4092,
      3900,  3772,  3644,  3516,  3388,  3260,  3132,  3004,
      2876,  2748,  2620,  2492,  2364,  2236,  2108,  1980,
      1884,  1820,  1756,  1692,  1628,  1564,  1500,  1436,
      1372,  1308,  1244,  1180,  1116,  1052,   988,   924,
       876,   844,   812,   780,   748,   716,   684,   652,
       620,   588,   556,   524,   492,   460,   428,   396,
       372,   356,   340,   324,   308,   292,   276,   260,
       244,   228,   212,   196,   180,   164,   148,   132,
       120,   112,   104,    96,    88,    80,    72,    64,
        56,    48,    40,    32,    24,    16,     8,     0
  ];
  
  for (let i = 0; i < mulawData.length; i++) {
    pcm16Data[i] = mulawToLinear[mulawData[i]];
  }
  
  return new Uint8Array(pcm16Data.buffer);
}

function pcm16ToMulaw(pcm16Data) {
  const int16Data = new Int16Array(pcm16Data.buffer);
  const mulawData = new Uint8Array(int16Data.length);
  
  for (let i = 0; i < int16Data.length; i++) {
    const sample = int16Data[i];
    const sign = (sample >> 8) & 0x80;
    let magnitude = sample < 0 ? -sample : sample;
    magnitude = Math.min(magnitude, 32635);
    
    let exp = 7;
    let expMask = 0x4000;
    for (let j = 0; j < 8; j++) {
      if ((magnitude & expMask) !== 0) break;
      exp--;
      expMask >>= 1;
    }
    
    const mantissa = (magnitude >> (exp + 3)) & 0x0F;
    mulawData[i] = ~(sign | (exp << 4) | mantissa);
  }
  
  return mulawData;
}

function encodeAudioToBase64(pcm16Data) {
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < pcm16Data.length; i += chunkSize) {
    const chunk = pcm16Data.subarray(i, Math.min(i + chunkSize, pcm16Data.length));
    binary += String.fromCharCode(...chunk);
  }
  
  return Buffer.from(binary, 'binary').toString('base64');
}

function decodeAudioFromBase64(base64Audio) {
  const binary = Buffer.from(base64Audio, 'base64');
  return new Uint8Array(binary);
}

function resampleAudio(inputData, inputSampleRate, outputSampleRate) {
  const inputSamples = new Int16Array(inputData.buffer);
  const resampleRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(inputSamples.length / resampleRatio);
  const outputSamples = new Int16Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const inputIndex = Math.floor(i * resampleRatio);
    outputSamples[i] = inputSamples[inputIndex] || 0;
  }
  
  return new Uint8Array(outputSamples.buffer);
}

module.exports = {
  mulawToPcm16,
  pcm16ToMulaw,
  encodeAudioToBase64,
  decodeAudioFromBase64,
  resampleAudio
};