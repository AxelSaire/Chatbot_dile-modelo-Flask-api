const axios = require('axios');
const venom = require('venom-bot');
const mongoose = require('mongoose');
const { API_TOKEN, API_URL } = require('./config');

// Conectar a MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/usuarios', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB');
}).catch((error) => {
  console.error('Error al conectar a MongoDB:', error);
});


async function consultarLicencia(dni) {
  const url = `https://api.factiliza.com/pe/v1/licencia/info/${dni}`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`
      }

    });
  

    console.log('Respuesta completa:', response.data); // Muestra la respuesta completa para ver el formato
    if (response.data.status == 200) { //response.data.success
      const data = response.data.data;
      console.log('Número de DNI:', response.data.data.numero_documento);
      console.log('Nombres:', response.data.data.nombres);
      console.log('Apellido Paterno:', response.data.data.apellido_paterno);
      console.log('Apellido Materno:', response.data.data.apellido_materno);
      console.log('licencia de conducir', response.data.data.licencia)
      return data;
    } else {
      console.log('Error en la respuesta:', response.data.message || 'No se pudo obtener la información');
    }
  } catch (error) {
    if (error.response) {
      console.error('Error HTTP:', error.response.status, error.response.data);
    } else {
      console.error('Error en la consulta:', error.message);
    }
  }
}
async function verificarNumeroDNI(numero){
  try {
    const response = await axios.post('http://127.0.0.1:5002/api/consultar', {
        dni:numero
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('API Response:', response.data);
    console.log('Prueba', response.data.data.puntaje);
    return response.data;
  } catch (error) {
    console.error('Error al verificar el usuario', error.response ? error.response.data : error.message);
    return false;
  }
}
async function consultarDNI(dni) {
    const url = `https://api.factiliza.com/pe/v1/dni/info/${dni}`;
  
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
    
  
      console.log('Respuesta completa:', response.data); // Muestra la respuesta completa para ver el formato
      if (response.data.success) {
        const data = response.data.data;
        return data;
      } else {
        console.log('Error en la respuesta:', response.data.message || 'No se pudo obtener la información');
      }
    } catch (error) {
      if (error.response) {
        console.error('Error HTTP:', error.response.status, error.response.data);
      } else {
        console.error('Error en la consulta:', error.message);
      }
    }
  }
const GetPerfilRiesgoSocio = async (EDAD, ESTADO_CIVIL, GIRO, NOM_FRECUENCIA, SEXO) => {
  try {
    //const response = await axios.post('http://127.0.0.1:5002/api/predict', {
    const response = await axios.post(API_URL, {
      NOM_FRECUENCIA: NOM_FRECUENCIA,
      EDAD: parseInt(EDAD),
      SEXO: SEXO,
      ESTADO_CIVIL: ESTADO_CIVIL,
      GIRO: GIRO
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('API Response:', response.data);
    console.log('Puntaje:', response.data.puntaje);
    console.log('Score:', response.data.score);
    return response.data[0];//response.data;//
  } catch (error) {
    console.error('Error al obtener el perfil de riesgo', error.response ? error.response.data : error.message);
    return false;
  }
};

// Definir el esquema y el modelo
const usuarioSchema = new mongoose.Schema({
  telefono: String,
  fechaConsulta:Date,
  horaConsulta:String,
  dni: String,
  datos: {
    nombres: String,
    apellido_paterno: String,
    apellido_materno: String,
    nombre_completo: String,
    departamento: String,
    provincia: String,
    distrito: String,
    direccion: String,
    direccion_completa: String,
    ubigeo_reniec: String,
    ubigeo_sunat: String,
    ubigeo: Array,
    fecha_nacimiento: Date,
    foto: String
  },
  edad: Number,
  sexo: String,
  estado_civil: String,
  giro: String,
  frecuencia: String,
  puntaje: Number,
  score: String
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

const userStates = {};

// Función para reiniciar el estado del usuario
function reiniciarEstadoUsuario(userState) {
  userState.step = 'bienvenida';
  userState.lastActivity = Date.now();
  userState.expirationShown = false;
  userState.warningShown = false;
  userState.processoCompletado = false;
  userState.dni = null;
  userState.datosReniec = null;
  userState.edad = null;
  userState.sexo = null;
  userState.estado_civil = null;
  userState.giro = null;
  userState.frecuencia = null;
}

const handleUserInput = async (client, message, userState) => {
  switch (userState.step) {
    case 'confirmacion_inicio':
      if (message.body.toLowerCase() === 'sí' || message.body.toLowerCase() === 'si') {
        // await client.getBatteryLevel();
        await client.sendText(message.from, "¡Perfecto! 🎉 Vamos a avanzar con tu solicitud.\n\nPor favor, ingresa tu *número de DNI*: 🆔");
        userState.step = 'esperando_dni';
      } else {
        await client.sendText(message.from, 
          "Entiendo que no estés listo. Cuando quieras comenzar, solo escribe *SÍ*. " +
          "Estaré aquí para ayudarte en cualquier momento."
        );
      }
      break;
    case 'inicio':
      await client.sendText(message.from, "¡Perfecto! 🎉 Vamos a avanzar con tu solicitud.\n\nPor favor, ingresa tu *número de DNI*: 🆔");
      userState.step = 'esperando_dni';
      break;
    case 'esperando_dni':
      const dni = message.body.trim();
    
      if (!isNaN(dni) && dni.length === 8) {
          const datosSocio = await verificarNumeroDNI(dni);
          console.log(datosSocio);     
        if (datosSocio.success) {
          // DNI exists in local database
          userState.dni = dni;
          userState.datosSocio = datosSocio;
          await client.sendText(message.from, `Hemos encontrado un registro tuyo. Tu *apellido paterno* es: *${datosSocio.data.datos.apellido_paterno.trim()}*. \n\n¿Es correcto? Responde *Sí* o *No*.`);
          userState.step = 'obtener_riesgo';
        } else {
          // DNI doesn't exist in local database, proceed to validate with Reniec
          userState.dni = dni;
          //message.body = '.';
          try {  
            const datosReniec = await consultarDNI(userState.dni);
            userState.datosReniec = datosReniec;
            await client.sendText(message.from, `Según nuestros registros, tu *apellido paterno* es: *${datosReniec.apellido_paterno}*.\n\nPor favor, confirma si es correcto respondiendo *Sí* o *No*.`);
            userState.step = 'confirmar_apellido';
          } catch (error) {
            console.error('Error al consultar DNI en Reniec:', error);
            await client.sendText(message.from, 'Hubo un problema al verificar tu DNI. Por favor, intenta nuevamente más tarde.');
            userState.step = 'esperando_dni';
          }
        }
      } else {
        await client.sendText(message.from, 'Por favor, ingresa un *DNI* válido (8 dígitos).');
      }
      break;
        // if (!isNaN(dni) && dni.length === 8) {
        //   try {
        //     const datosSocio = await verificarNumeroDNI(dni);
        //     console.log(datosSocio);
            
        //     if (datosSocio.success) {
        //       // DNI exists in local database
        //       userState.dni = dni;
        //       userState.datosSocio = datosSocio;
        //       await client.sendText(message.from, `Hemos encontrado tu registro. Tu nombre completo es: ${datosSocio.data.datos.nombres}. ¿Es correcto? Responde *Sí* o *No*.`);
        //       userState.step = 'obtener_riesgo';
        //     } else {
        //       // DNI doesn't exist in local database, proceed to validate with Reniec
        //       userState.dni = dni;
        //       userState.step = 'validar_dni';
        //       // Fall through to the next case without breaking
        //     }
        //   } catch (error) {
        //     console.error('Error al verificar DNI en base local:', error);
        //     await client.sendText(message.from, 'Hubo un problema al verificar tu DNI. Por favor, intenta nuevamente más tarde.');
        //     break;
        //   }
        // } else {
        //   await client.sendText(message.from, 'Por favor, ingresa un *DNI* válido (8 dígitos).');
        //   break;
        // }
    /*
    case 'validar_dni':
      try {  
        const datosReniec = await consultarDNI(userState.dni);
        userState.datosReniec = datosReniec;
        await client.sendText(message.from, `Según nuestros registros, tu *apellido paterno* es: *${datosReniec.apellido_paterno}*.\n\nPor favor, confirma si es correcto respondiendo *Sí* o *No*.`);
        userState.step = 'confirmar_apellido';
      } catch (error) {
        console.error('Error al consultar DNI en Reniec:', error);
        await client.sendText(message.from, 'Hubo un problema al verificar tu DNI. Por favor, intenta nuevamente más tarde.');
        userState.step = 'esperando_dni';
      }
      break;
      */
    case 'confirmar_apellido':
      const confirmacion = message.body.trim().toLowerCase();

      if (confirmacion === 'sí' || confirmacion === 'si') {
        const { nombres, apellido_paterno, apellido_materno, nombre_completo, departamento, provincia, distrito, direccion, direccion_completa, ubigeo_reniec, ubigeo_sunat, ubigeo, fecha_nacimiento, estado_civil, foto, sexo } = userState.datosReniec;
        await client.sendText(message.from, `Hola *${nombres.trim()}* Gracias por escribirnos\n\n Ahora, por favor dime tu *edad*: 🎂`);
        userState.step = 'esperando_edad';
      } else if (confirmacion === 'no') {
        await client.sendText(message.from, 'Por favor, ingresa nuevamente tu *DNI* correctamente: 🆔');
        userState.step = 'esperando_dni';
      } else {
        await client.sendText(message.from, 'Por favor, responde *Sí* o *No* para confirmar tu apellido.');
      }
      break;
   
    case 'esperando_edad':
      const edad = parseInt(message.body.trim());
      if (!isNaN(edad)) {
        if (edad >= 23 && edad <= 65) {
          userState.edad = edad;
          await client.sendText(message.from, 'Selecciona tu *sexo*:\n1️⃣ *Femenino*\n2️⃣ *Masculino*');
          userState.step = 'esperando_sexo';
        } else {
          if (edad < 23) {
            await client.sendText(message.from, 'Lo sentimos, aún no calificas para este servicio. La edad mínima requerida es 23 años.');
          } else {
            await client.sendText(message.from, 'Lo sentimos, no cumples con los requisitos de edad para este servicio. La edad máxima permitida es 65 años.');
          }
          await client.sendText(message.from, '¿Deseas intentar nuevamente con otro DNI? Responde *Sí* para reiniciar o *No* para terminar.');
          userState.step = 'reiniciar_o_terminar';
        }
      } else {
        await client.sendText(message.from, 'Por favor, ingresa una *edad* válida en números.');
      }
      break;

    case 'reiniciar_o_terminar':
      const respuesta = message.body.trim().toLowerCase();
      if (respuesta === 'sí' || respuesta === 'si') {
        await client.sendText(message.from, "Vamos a empezar de nuevo. Por favor, ingresa tu *número de DNI*: 🆔");
        userState.step = 'esperando_dni';
      } else if (respuesta === 'no') {
        await client.sendText(message.from, "Gracias por tu interés. Si en el futuro cumples con los requisitos, no dudes en contactarnos nuevamente.");
        userState.step = 'inicio';  // O podrías tener un estado 'finalizado' si prefieres
      } else {
        await client.sendText(message.from, 'Por favor, responde *Sí* para reiniciar o *No* para terminar.');
      }
      break;
    case 'esperando_sexo':
      if (['1', '2'].includes(message.body.trim())) {
        userState.sexo = message.body.trim();
        await client.sendText(message.from, 'Ahora, selecciona tu *estado civil*:\n1️⃣ *Casado(a)* 💍\n2️⃣ *Conviviente* 🤝\n3️⃣ *Divorciado(a)* 🔄\n4️⃣ *Separado(a)* ↔️\n5️⃣ *Soltero(a)*\n6️⃣ *Viudo(a)*');
        userState.step = 'esperando_estado_civil';
      } else {
        await client.sendText(message.from, 'Por favor, selecciona una opción válida:\n1️⃣ *Femenino*\n2️⃣ *Masculino*');
      }
      break;
    case 'esperando_estado_civil':
      if (['1', '2', '3', '4', '5', '6'].includes(message.body.trim())) {
        userState.estado_civil = message.body.trim();
        await client.sendText(message.from, 'Selecciona tu *ocupación*:\n1️⃣ ABARROTES 🛒\n2️⃣ AUTOMOTRIZ 🚗\n3️⃣ BOTICA 💊\n4️⃣ CARPINTERÍA 🪚\n5️⃣ COMERCIANTE 🏪\n6️⃣ COMERCIO DE ALIMENTOS 🥗\n7️⃣ COMERCIO DE ANIMALES 🐾\n8️⃣ COMERCIO DE ARTESANÍA 🎨\n9️⃣ COMERCIO DE BEBIDAS 🥤\n🔟 COMERCIO DE CELULARES 📱\n1️⃣1️⃣ COMERCIO DE PROD. NO ALIMENTICIOS 🛍️\n1️⃣2️⃣ COMERCIO DE ROPA 👕\n1️⃣3️⃣ COMERCIO FERRETERO 🧰\n1️⃣4️⃣ COMERCIO MINORista 🏬\n1️⃣5️⃣ OFICIO 🧑‍🔧\n1️⃣6️⃣ OFICIO CONSTRUCCIÓN 🏗️\n1️⃣7️⃣ OTROS 🌐\n1️⃣8️⃣ PRESTADOR DE SERVICIOS 📑\n1️⃣9️⃣ PROFESIONAL 👔\n2️⃣0️⃣ RESTAURANTE 🍽️');
        userState.step = 'esperando_giro';
      } else {
        await client.sendText(message.from, 'Por favor, selecciona una opción válida entre 1️⃣ y 6️⃣.');
      }
      break;
    case 'esperando_giro':
      if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'].includes(message.body.trim())) {
        userState.giro = message.body.trim();
        await client.sendText(message.from, '¿Cómo prefieres pagar tus cuotas? 💰\n1️⃣ *Meses* 📅\n2️⃣ *Semanas* 📆');
        userState.step = 'esperando_frecuencia';
      } else {
        await client.sendText(message.from, 'Por favor, selecciona una opción válida entre 1️⃣ y 2️⃣0️⃣.');
      }
      break;
      
    case 'esperando_frecuencia':
      if (['1', '2'].includes(message.body.trim())) {
        userState.frecuencia = message.body.trim();

        // Llamar a la API para obtener el perfil de riesgo
        const perfilRiesgo = await GetPerfilRiesgoSocio(userState.edad, userState.estado_civil, userState.giro, userState.frecuencia, userState.sexo);
        console.log(perfilRiesgo);
        if (perfilRiesgo && perfilRiesgo.puntaje != undefined) {
          await client.sendText(message.from, `Tu *score crediticio* es: *${perfilRiesgo.puntaje.toFixed(3)}* 📊`);
          await client.sendText(message.from, `Calificación: *${perfilRiesgo.score}*`);

          if (perfilRiesgo.score === 'Bueno') {
            await client.sendText(message.from, '¡Felicitaciones! Tienes una alta posibilidad de acceder al crédito. Un asesor financiero se comunicará contigo pronto. 📞');
          } else if (perfilRiesgo.score === 'Regular') {
            await client.sendText(message.from, 'Tienes una posibilidad moderada de acceder al crédito. Un asesor financiero se comunicará contigo para discutir tus opciones. 📞');
          } else {
            await client.sendText(message.from, 'Lo sentimos, tu *score* no es favorable. Sin embargo, un asesor financiero se comunicará contigo para explorar otras opciones. 📞');
          }
        //   let m = userState.lastActivity
          const date = new Date(userState.lastActivity);
          fecha = formatDate(date);
          hora = formatTime(date)
        //   console.log(hora);
        //   let dateString = m.getUTCFullYear() +"/"+ (m.getUTCMonth()+1) +"/"+ m.getUTCDate() + " " + m.getUTCHours() + ":" + m.getUTCMinutes() + ":" + m.getUTCSeconds();
        //   console.log(typeof(hora));
          // Guardar los datos 
          const nuevoUsuario = new Usuario({
            telefono: message.from,
            fechaConsulta: fecha,
            horaConsulta: hora,
            dni: userState.dni,
            datos: {
                nombres: userState.datosReniec.nombres,
                apellido_paterno: userState.datosReniec.apellido_paterno,
                apellido_materno: userState.datosReniec.apellido_materno,
                nombre_completo: userState.datosReniec.nombre_completo,
                departamento: userState.datosReniec.departamento,
                provincia: userState.datosReniec.provincia,
                distrito: userState.datosReniec.distrito,
                direccion: userState.datosReniec.direccion,
                direccion_completa: userState.datosReniec.direccion_completa,
                ubigeo_reniec: userState.datosReniec.ubigeo_reniec,
                ubigeo_sunat: userState.datosReniec.ubigeo_sunat,
                ubigeo: userState.datosReniec.ubigeo,
                fecha_nacimiento: userState.datosReniec.fecha_nacimiento,
                foto: userState.datosReniec.foto
              },
            edad: parseInt(userState.edad),
            sexo: userState.sexo,
            estado_civil: userState.estado_civil,
            giro: userState.giro,
            frecuencia: userState.frecuencia,
            puntaje: perfilRiesgo.puntaje,
            score: perfilRiesgo.score
          });

          await nuevoUsuario.save();

          // Mensaje de finalización
          await client.sendText(message.from, 'Gracias por completar el proceso. Si necesitas algo más, no dudes en contactarnos nuevamente.');
          
          // Marcar el proceso como completado
          userState.processoCompletado = true;

        } else {
          await client.sendText(message.from, 'Hubo un problema al obtener tu perfil de riesgo. Por favor, inténtalo nuevamente más tarde.');
          reiniciarEstadoUsuario(userState);
        }
      } else {
        await client.sendText(message.from, 'Por favor, selecciona una opción válida:\n1️⃣ *Meses* 📅\n2️⃣ *Semanas* 📆');
      }
      break;
    case 'obtener_riesgo':
      console.log('Entrando al caso final');
      // console.log(userState.datosSocio)
      await client.sendText(message.from, `Hola *${userState.datosSocio.data.datos.nombre_completo.trim()}*\n\n Gracias por confiar en nosotros🫡`);
      await client.sendText(message.from, `Tu *score crediticio* es: *${userState.datosSocio.data.puntaje}* 📊\n\n y tu *Calificación* es: *${userState.datosSocio.data.score}* `);
      userState.processoCompletado = true;
      break;
    default:
      reiniciarEstadoUsuario(userState);
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

const TIMEOUT = 2 * 60 * 1000; // 2 minutos en milisegundos
const WARNING_TIME = 1 * 60 * 1000; // 1 minuto en milisegundos

function formatDate(date) {
    // Extract year, month, and day for YYYY-MM-DD format
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-based
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
function formatTime(date) {
    // Subtract 5 hours from the current time
    date.setHours(date.getHours());
  
    // Extract hours, minutes, seconds, and milliseconds for HH:mm:ss.SSS format
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}
function reiniciarEstadoUsuario(userState) {
  userState.step = 'bienvenida';
  userState.lastActivity = Date.now();
  userState.expirationShown = false;
  userState.warningShown = false;
  userState.processoCompletado = false; // Nuevo estado
}

function start(client) {
  client.onMessage(async message => {
    console.log('Mensaje recibido:', message.body);
    let userState = userStates[message.from] || { step: 'bienvenida', lastActivity: Date.now(), warningShown: false, expirationShown: false, processoCompletado: false };

    // Si el proceso está completado o es un nuevo mensaje, reinicia el estado
    if (userState.processoCompletado || ['hola', 'hello', 'volver', 'salir', 'inicio', 'empezar'].includes(message.body.toLowerCase().trim())) {
      reiniciarEstadoUsuario(userState);
    }
    userStates[message.from] = userState;

    // Actualizar el tiempo de última actividad
    userState.lastActivity = Date.now();
    userState.warningShown = false;
    userState.expirationShown = false;

    if (userState.step === 'bienvenida') {
      await client.sendText(message.from, 
        "¡Hola! 👋 ✨ Soy *ESTRELLA* ✨, tu asistente para conseguir el crédito digital que necesitas, ¡rápido y sin complicaciones! 💸\n\n"+
        "Para ofrecerte las mejores opciones, me gustaría conocerte un poco mejor. 😊\n\n" +
        "¿Estás listo para empezar? Responde con *SÍ* y comenzamos. 👍"
      );
      userState.step = 'confirmacion_inicio';
    } else {
      await handleUserInput(client, message, userState);
    }

    console.log('Estado final del usuario:', userStates[message.from]);
  });

  // Configurar un intervalo para verificar sesiones inactivas
  setInterval(() => {
    const now = Date.now();
    for (let [userId, state] of Object.entries(userStates)) {
      // Solo verificar si el proceso no está completado
      if (!state.processoCompletado) {
        const inactiveTime = now - state.lastActivity;
        if (inactiveTime > WARNING_TIME && inactiveTime <= TIMEOUT && !state.warningShown) {
          client.sendText(userId, `¿Sigues ahí? Tu sesión se cerrará por inactividad en ${Math.ceil((TIMEOUT - inactiveTime) / 60000)} minuto(s). Si quieres continuar, digite su respuesta.`);
          state.warningShown = true;
        } else if (inactiveTime > TIMEOUT && !state.expirationShown) {
          client.sendText(userId, "Tu sesión ha expirado por inactividad. Por favor, escribe 'hola' para comenzar de nuevo cuando estés listo.");
          reiniciarEstadoUsuario(state);
          state.expirationShown = true;
        }
      }
    }
  }, WARNING_TIME);
}