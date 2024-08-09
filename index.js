const axios = require('axios');
const venom = require('venom-bot');
const mongoose = require('mongoose');

// Conectar a MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/usuarios', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB');
}).catch((error) => {
  console.error('Error al conectar a MongoDB:', error);
});

const GetPerfilRiesgoSocio = async (EDAD, TIPO_VIVIENDA, ESTADO_CIVIL, GIRO, NOM_FRECUENCIA) => {
  try {
    const response = await axios.post('http://127.0.0.1:5001/api/predict', {
      NOM_FRECUENCIA,
      EDAD: parseInt(EDAD),
      TIPO_VIVIENDA,
      ESTADO_CIVIL,
      GIRO
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('API Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error al obtener el perfil de riesgo', error.response ? error.response.data : error.message);
    return false;
  }
};

const GetDatos = async (dni, attempt = 1) => {
  const url = `https://api.wfacxs.com/consultas/dni/${dni}`;
  const maxAttempts = 2; // Número máximo de intentos

  try {
    const response = await axios.get(url);
    console.log(`Intento ${attempt}: Respuesta completa`, response.data);
    
    if (response.data.success) {
      const data = response.data.data;
      console.log('Nombre Completo:', data.nombre_completo);
      return response.data;
    } else {
      console.log('Error en la respuesta:', response.data.message || 'No se pudo obtener la información');
      if (attempt < maxAttempts) {
        console.log('Reintentando...');
        return GetDatos(dni, attempt + 1);
      }
      else{
        return false;
      }
    }
  } catch (error) {
    if (error.response) {
      console.error('Error HTTP:', error.response.status, error.response.data);
      return false;
    } else {
      console.error('Error en la consulta:', error.message);
    }
    if (attempt < maxAttempts) {
      console.log('Reintentando...');
      return GetDatos(dni, attempt + 1);
    }
  }
}
//   try {
//     const response = await axios.get(url);
//     console.log('Respuesta completa:', response.data); // Muestra la respuesta completa para ver el formato
//     if (response.data.success) {
//       const data = response.data.data;
//       console.log('Número de DNI:', data.numero);
//       console.log('Nombre Completo:', data.nombre_completo);
//       console.log('Nombres:', data.nombres);
//       console.log('Apellido Paterno:', data.apellido_paterno);
//       console.log('Apellido Materno:', data.apellido_materno);
//       return response.data;
//     } else {
//       console.log('Error en la respuesta:', response.data.message || 'No se pudo obtener la información');
//     }
//   } catch (error) {
//     if (error.response) {
//       console.error('Error HTTP:', error.response.status, error.response.data);
//     } else {
//       console.error('Error en la consulta:', error.message);
//     }
//   }
// }
// Definir el esquema y el modelo
const usuarioSchema = new mongoose.Schema({
  telefono: String,
  dni: String,
  nombres: String,
  edad: Number,
  tipo_vivienda: String,
  estado_civil: String,
  giro: String,
  frecuencia: String,
  puntaje: Number,
  score: String
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

const userStates = {};

const handleUserInput = async (client, message, userState) => {
  switch (userState.step) {
    case 'inicio':
      await client.sendText(message.from, 'Excelente🎉. Comencemos con tu evaluación de riesgo crediticio. Por favor, digita tu número de tu DNI:');
      userState.step = 'esperando_dni';
      break;
    case 'esperando_dni':
      if (!isNaN(message.body.trim())) {
        userState.dni = message.body.trim();
        const datos = await GetDatos(userState.dni)
        console.log(datos);
        if (datos.success == true) {
          userState.datos = datos.data.nombre_completo
          try {
            await client.sendText(message.from,
              `Hola *${datos.data.nombres}*✨,\n\nEstamos encantados de que consideres nuestro *crédito digital*. Para ayudarte de la mejor manera posible, necesitamos conocerte un poco más. Por favor, responde las siguientes preguntas con total honestidad. ¡Gracias por tu confianza!`
            );
          } catch (error) {
            console.error('Error al enviar el mensaje:', error);
          }
          await client.sendText(message.from, 'Por favor, ingresa tu edad: 🕯️🕯️🕯️');
          userState.step = 'esperando_edad';
        }
      } else {
        await client.sendText(message.from, 'Por favor, ingresa un DNI válido.🫗');
      }
      break;
    case 'esperando_edad':
      if (!isNaN(message.body.trim())) {
        userState.edad = message.body.trim();
        await client.sendText(message.from, 'Por favor, selecciona tu tipo de vivienda:\n1️⃣ ALQUILADA🏬\n2️⃣ FAMILIAR🏠\n3️⃣ PROPIA🏡');
        userState.step = 'esperando_tipo_vivienda';
      } else {
        await client.sendText(message.from, 'Por favor, ingresa una edad válida.🫗');
      }
      break;
    case 'esperando_tipo_vivienda':
      if (['1', '2', '3'].includes(message.body.trim())) {
        const viviendaMap = {
          '1': 'ALQUILADA',
          '2': 'FAMILIAR',
          '3': 'PROPIA'
        };
        userState.tipo_vivienda = viviendaMap[message.body.trim()];
        await client.sendText(message.from, 'Por favor, selecciona tu estado civil:\n1️⃣ Casado (a)💍\n2️⃣ Conviviente👫\n3️⃣ Divorciado (a) ⚮\n4️⃣ Separado (a)🧍\n5️⃣ Soltero (a)🙋\n6️⃣ Viudo (a)👵');
        userState.step = 'esperando_estado_civil';
      } else {
        await client.sendText(message.from, 'Por favor, selecciona una opción válida:\n1️⃣ ALQUILADA\n2️⃣ FAMILIAR\n3️⃣ PROPIA');
      }
      break;
    case 'esperando_estado_civil':
      if (['1', '2', '3', '4', '5', '6'].includes(message.body.trim())) {
        const estadoCivilMap = {
          '1': 'Casado (a)',
          '2': 'Conviviente',
          '3': 'Divorciado (a)',
          '4': 'Separado (a)',
          '5': 'Soltero (a)',
          '6': 'Viudo (a)'
        };
        userState.estado_civil = estadoCivilMap[message.body.trim()];
        await client.sendText(message.from, 'Por favor, selecciona tu ocupación:\n1️⃣ ABARROTES\n2️⃣ AUTOMOTRIZ\n3️⃣ BOTICA\n4️⃣ CARPINTERIA\n5️⃣ COMERCIANTE\n6️⃣ COMERCIO DE ALIMENTOS\n7️⃣ COMERCIO DE ANIMALES\n8️⃣ COMERCIO DE ARTESANIA\n9️⃣ COMERCIO DE BEBIDAS\n🔟 COMERCIO DE CELULARES\n1️⃣1️⃣ COMERCIO DE PROD NO ALIMENTICIOS\n1️⃣2️⃣ COMERCIO DE ROPA\n1️⃣3️⃣ COMERCIO FERRETERO\n1️⃣4️⃣ COMERCIO MINORISTA\n1️⃣5️⃣ OFICIO\n1️⃣6️⃣ OFICIO CONSTRUCCION\n1️⃣7️⃣ OTROS\n1️⃣8️⃣ PRESTADOR DE SERVICIOS\n1️⃣9️⃣ PROFESIONAL\n2️⃣0️⃣ RESTAURANTE');
        userState.step = 'esperando_giro';
      } else {
        await client.sendText(message.from, 'Por favor, selecciona una opción válida:\n1. Casado (a)\n2. Conviviente\n3. Divorciado (a)\n4. Separado (a)\n5. Soltero (a)\n6. Viudo (a)');
      }
      break;
    case 'esperando_giro':
      if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'].includes(message.body.trim())) {
        const giroMap = {
          '1': 'ABARROTES',
          '2': 'AUTOMOTRIZ',
          '3': 'BOTICA',
          '4': 'CARPINTERIA',
          '5': 'COMERCIANTE',
          '6': 'COMERCIO DE ALIMENTOS',
          '7': 'COMERCIO DE ANIMALES',
          '8': 'COMERCIO DE ARTESANIA',
          '9': 'COMERCIO DE BEBIDAS',
          '10': 'COMERCIO DE CELULARES',
          '11': 'COMERCIO DE PROD NO ALIMENTICIOS',
          '12': 'COMERCIO DE ROPA',
          '13': 'COMERCIO FERRETERO',
          '14': 'COMERCIO MINORISTA',
          '15': 'OFICIO',
          '16': 'OFICIO CONSTRUCCION',
          '17': 'OTROS',
          '18': 'PRESTADOR DE SERVICIOS',
          '19': 'PROFESIONAL',
          '20': 'RESTAURANTE'
        };
        userState.giro = giroMap[message.body.trim()];
        await client.sendText(message.from, 'Por favor, selecciona con qué frecuencia te gustaría pagar tus cuotas 🗓️:\n1. DIARIA\n2. MENSUAL\n3. SEMANAL');
        userState.step = 'esperando_frecuencia';
      } else {
        await client.sendText(message.from, 'Por favor, selecciona una opción válida entre 1 y 20.');
      }
      break;
    case 'esperando_frecuencia':
      if (['1', '2', '3'].includes(message.body.trim())) {
        const frecuenciaMap = {
          '1': 'DIARIA',
          '2': 'MENSUAL',
          '3': 'SEMANAL'
        };
        userState.frecuencia = frecuenciaMap[message.body.trim()];

        // Llamar a la API local para obtener el perfil de riesgo
        const perfilRiesgo = await GetPerfilRiesgoSocio(userState.edad, userState.tipo_vivienda, userState.estado_civil, userState.giro, userState.frecuencia);
        if (perfilRiesgo && perfilRiesgo.puntaje !== undefined) {
          await client.sendText(message.from, `Tu score crediticio es: ${perfilRiesgo.puntaje_complemento.toFixed(3)}`);
          await client.sendText(message.from, `Calificación: ${perfilRiesgo.score}`);

          // Guardar los datos en MongoDB
          const nuevoUsuario = new Usuario({
            telefono: message.from,
            dni: userState.dni,
            nombres : userState.datos,
            edad: parseInt(userState.edad),
            tipo_vivienda: userState.tipo_vivienda,
            estado_civil: userState.estado_civil,
            giro: userState.giro,
            frecuencia: userState.frecuencia,
            puntaje: perfilRiesgo.puntaje,
            score: perfilRiesgo.score
          });

          await nuevoUsuario.save();

          // Reiniciar el estado del usuario
          userState.step = 'inicio';
        } else {
          await client.sendText(message.from, 'Hubo un problema al obtener tu perfil de riesgo. Por favor, inténtalo nuevamente más tarde.');
          userState.step = 'inicio';
        }
      } else {
        await client.sendText(message.from, 'Por favor, selecciona una opción válida:\n1. DIARIA\n2. MENSUAL\n3. SEMANAL');
      }
      break;
    default:
      userState.step = 'inicio';
      await client.sendText(message.from, 'Bienvenido. Vamos a calcular tu perfil de riesgo.');
      await handleUserInput(client, message, userState);
  }
};

// Iniciar sesión y escuchar mensajes
venom
  .create({
    session: 'session-name',
    multidevice: true,
    folderNameToken: 'tokens',
    mkdirFolderToken: './sessions',
  })
  .then((client) => {
    console.log('Cliente de WhatsApp listo!');
    start(client);
  })
  .catch((error) => {
    console.error('Error al iniciar el cliente de WhatsApp:', error);
  });

// flujo principal
function start(client) {
  client.onMessage(async message => {
    console.log('Mensaje recibido:', message.body);
    let userState = userStates[message.from] || { step: 'bienvenida' };
    userStates[message.from] = userState;

    if (userState.step === 'bienvenida') {
      await client.sendText(message.from, 
        "¡Bienvenido! 👋 Soy ✨ *ESTRELLA* ✨, un bot que te ayudará a poder acceder al creddito digital para lo cual necsitas obtener tu perfil de riesgo crediticio. " +
        "Para comenzar, necesitaré algunos datos. ¿Estás listo para empezar? Responde *SÍ* para continuar."
      );
      userState.step = 'confirmacion_inicio';
    } else if (userState.step === 'confirmacion_inicio') {
      if (message.body.toLowerCase() === 'sí' || message.body.toLowerCase() === 'si') {
        userState.step = 'inicio';
        await handleUserInput(client, message, userState);
      } else {
        await client.sendText(message.from, 
          "Entiendo que no estés listo. Cuando quieras comenzar, solo escribe *SÍ*. " +
          "Estaré aquí para ayudarte en cualquier momento."
        );
      }
    } else {
      await handleUserInput(client, message, userState);
    }

    console.log('Estado final del usuario:', userStates[message.from]);
  });
}