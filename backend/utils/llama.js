import Groq from 'groq-sdk';

const resolveGroqApiKey = () => process.env.GROQ_KEY || process.env.GROQ_API_KEY || '';

const getGroqClient = () => {
  const apiKey = resolveGroqApiKey();
  if (!apiKey) {
    throw new Error('GROQ_KEY no esta configurada');
  }

  return new Groq({ apiKey });
};

export const getllamaSurvey = async (notas) => { //recibir tipo y datos
  console.log(notas);
  const groq = getGroqClient();
  const chatCompletion = await groq.chat.completions.create({
    messages: [{
      role: 'user', content: `${notas}
        Los datos presentados corresponden a la información de rendimiento académico de los estudiantes de primer nivel de TICs. Cada materia tiene un número diferente de matriculados pero son los mismos estudiantes. Realiza un análisis del rendimiento del curso redactando de manera formal y en párrafos los resultados en español.` }],
    model: 'llama3-8b-8192',
  });

  console.log(chatCompletion.choices[0].message.content);
  return chatCompletion.choices[0].message.content
}