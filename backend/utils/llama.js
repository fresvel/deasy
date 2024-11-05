import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_KEY//process.env['GROQ_API_KEY'], // This is the default and can be omitted
});

export const  getllamaSurvey=async(notas)=> { //recibir tipo y datos
    console.log(notas);
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: `${notas}
        Los datos presentados corresponden a la información de rendimiento académico de los estudiantes de primer nivel de TICs. Cada materia tiene un número diferente de matriculados pero son los mismos estudiantes. Realiza un análisis del rendimiento del curso redactando de manera formal y en párrafos los resultados en español.` }],
      model: 'llama3-8b-8192',
    });
  
    console.log(chatCompletion.choices[0].message.content);
    return chatCompletion.choices[0].message.content
}