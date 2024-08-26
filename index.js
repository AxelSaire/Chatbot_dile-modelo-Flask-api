const axios = require('axios');
const venom = require('venom-bot');
const mongoose = require('mongoose');
const { API_TOKEN, API_URL, USUARIO_TOKEN } = require('./config');
const dicc = require('./dict.js');
const exclusionList = require('./exclusion_list.js');
const fs = require('fs').promises;
const XLSX = require("xlsx");
const path = require("path");

// Conectar a MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/usuarios', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB');
}).catch((error) => {
  console.error('Error al conectar a MongoDB:', error);
});

/************************************* enviar reporte a  colaboradores autorizados */
//Manejo del comando de reporte
const handleReportCommand = async (client, message, reportState) => {
  const sendMessage = async (text) => await client.sendText(message.from, text);
  const getSafeMessageBody = () => (message?.body?.trim() ?? '');

  const handleSteps = {
    inicio_reporte: async () => {
      await sendMessage("Has solicitado un reporte. Por favor, proporciona la siguiente información:");
      await sendMessage("Ingresa tu número de usuario (8 dígitos):");
      reportState.step = 'esperando_user';
      reportState.lastActivity = Date.now();
    },
    esperando_user: async () => {
      const user = getSafeMessageBody();
      if (/^\d{8}$/.test(user)) {
        reportState.user = user;
        await sendMessage("Ingresa la fecha de inicio del reporte (formato YYYY-MM-DD):");
        reportState.step = 'esperando_fecha_inicio';
        reportState.lastActivity = Date.now();
      } else {
        await sendMessage("Por favor, ingresa un número de usuario válido de 8 dígitos.");
      }
    },
    esperando_fecha_inicio: async () => {
      const fechaInicio = getSafeMessageBody();
      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
        reportState.fecha_inicio = fechaInicio;
        await sendMessage("Ingresa la fecha de fin del reporte (formato YYYY-MM-DD, mayor a 2024-08-12):");
        reportState.step = 'esperando_fecha_fin';
        reportState.lastActivity = Date.now();
      } else {
        await sendMessage("Formato de fecha incorrecto. Por favor, usa el formato YYYY-MM-DD.");
      }
    },
    esperando_fecha_fin: async () => {
      const fechaFin = getSafeMessageBody();
      const fechaLimite = new Date("2024-08-12");
      const fechaFinDate = new Date(fechaFin);

      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
        if (fechaFinDate > fechaLimite) {
          reportState.fecha_fin = fechaFin;
          await generarYEnviarReporte(client, message.from, reportState);
          await sendMessage("Reporte completado. Si necesitas algo más estoy aquí a la espera.");
          reportState.processoCompletado = true;
          reportState.step = 'bienvenida';
          reportState.lastActivity = Date.now();
        } else {
          await sendMessage("La fecha de fin debe ser posterior al 12 de agosto de 2024.");
        }
      } else {
        await sendMessage("Formato de fecha incorrecto. Por favor, usa el formato YYYY-MM-DD.");
      }
    }
  };

  if (handleSteps[reportState.step]) {
    await handleSteps[reportState.step]();
  } else {
    // Reiniciar el estado y procesoCompletado al iniciar un nuevo proceso
    reiniciarEstadoUsuario(reportState);
    await sendMessage('Bienvenido.');
    await handleSteps.inicio_reporte();
  }
};
//--------------extraer data
async function obtenerDatosDeAPI(reportState) {
  try {
    const response = await fetch('https://ram-special-evenly.ngrok-free.app/api-mongo/api/get_report_chatbotv1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: reportState.user,
        token: USUARIO_TOKEN,
        fecha_inicio: reportState.fecha_inicio,
        fecha_fin: reportState.fecha_fin
      })
    });

    if (!response.ok) {
      const rawResponse = await response.text();
      console.error('Error en la API (raw response):', rawResponse);
      throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log('Respuesta de la API:', responseData);

    // Verificar si la respuesta es un array
    if (Array.isArray(responseData) && responseData.length > 0) {
      const firstItem = responseData[0];

      // Verificar si el primer elemento tiene la propiedad `data`
      if (firstItem.data) {
        return firstItem.data; // Retorna solo los registros de datos
      } else {
        throw new Error("La propiedad 'data' no se encuentra en la respuesta de la API");
      }
    } else {
      throw new Error("La respuesta de la API no es un array o está vacía");
    }
  } catch (error) {
    console.error('Error al obtener datos de la API:', error);
    throw error;
  }
};


async function generarYEnviarReporte(client, numero, reportState) {
  try {
    await client.sendText(numero, "Procesando tu solicitud de reporte...");

    const responseData = await obtenerDatosDeAPI(reportState);

    if (responseData.length === 0) {
      await client.sendText(numero, "No se encontraron datos para el período especificado.");
      return;
    }

    // Crear el libro de Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(responseData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');

    // Guardar el libro de Excel en un archivo temporal
    const filePath = `${__dirname}/reporte_${reportState.fecha_inicio}_${reportState.fecha_fin}.xlsx`;
    XLSX.writeFile(workbook, filePath);

    // Enviar el archivo Excel
    await client.sendFile(
      numero,
      filePath,
      `Reporte_${reportState.fecha_inicio}_${reportState.fecha_fin}.xlsx`,
      `Reporte del ${reportState.fecha_inicio} al ${reportState.fecha_fin}`
    );

    // Eliminar el archivo temporal
    await eliminarArchivo(filePath);

    await client.sendText(numero, "Reporte generado y enviado con éxito.");
  } catch (error) {
    console.error('Error al generar y enviar el reporte:', error);
    await client.sendText(numero, "Hubo un error al generar el reporte. Por favor, contacta al administrador del sistema.");
  }
};
// Función para eliminar archivo temporal
async function eliminarArchivo(filePath) {
  try {
    await fs.unlink(filePath);
    console.log('Archivo temporal eliminado:', filePath);
  } catch (error) {
    console.error('Error al eliminar el archivo temporal:', error);
  }
};
//--------------
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
      const {status, data} = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`
        },
        timeout: 10000
      });
    
      if (status === 200 && data?.data) {
        console.log(data);
        return data.data;
      }
      console.warn('Respuesta inesperada:', data);
      return { error: 'UNEXPECTED_RESPONSE', message:'Respuesta inesperada del servidor.'};
      } catch ({response, request, message}){
        if(response?.status == 404) return { error:'DNI_NOT_FOUND', message:'No se encontró informacion para el DNI proporcionado.' };
        console.error(response?`Error de respuesta: ${response.status}`: request? 'No ser encontró información para el DNI proporcionado':`Error:${message}`);
        return { error: 'REQUEST_FAILED', message:'Hubo un problema al consultar el DNI.'};
      }
    };
const enviarDatosUsuario = async(datosUsuario)=>{
  try{
    const response = await axios.post('https://ram-special-evenly.ngrok-free.app/api-mongo/api/miPerfil_v1_1', datosUsuario);
    console.log('Datos enviados exitosamente:', response.data);
    return response.data;
  }catch(error){
    console.error('Error al enviar datos:', error);
    throw error;
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
function actualizarDatos(dni, estado_civil, giro,frecuencia, puntaje, score) {
  axios.post('http://127.0.0.1:5002/api/actualizar', {
      dni: dni,
      estado_civil: estado_civil,
      giro: giro,
      frecuencia: frecuencia, 
      puntaje: puntaje,
      score: score
  })
  .then(function (response) {
      // Manejar la respuesta exitosa
      if (response.data.success) {
          console.log("Usuario actualizado:", response.data.message);
      } else {
          console.warn("No se pudo actualizar el usuario:", response.data.message);
      }
  })
  .catch(function (error) {
      // Manejar errores
      console.error("Error en la actualización:", error.response ? error.response.data : error.message);
  });
}
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
  Object.assign(userState,{
    step : 'bienvenida',
    lastActivity : Date.now(),
    expirationShown : false,
    warningShown : false,
    processoCompletado : false,
    dni : null,
    datosReniec : null,
    edad : null,
    sexo : null,
    estado_civil : null,
    giro : null,
    frecuencia : null,
    reportState : null,
    user : null,
    fechaInicio : null,
    fecha_fin : null
  });

};

const handleUserInput = async (client, message, userState) => {
  const sendMessage = async (text) => await client.sendText(message.from, text);
  const isValidValue = (value) => value !== null && value !== undefined && value !== '';
  const getSafeMessageBody = ()=> message?.body?.trim()?? '';

  const handleSteps ={
    confirmacion_inicio:async () => {
      const response = getSafeMessageBody().toLowerCase();
      if(response === 'si' || response === 'sí'){
        await sendMessage("¡Perfecto! 🎉 Vamos a avanzar con tu solicitud.\n\nPor favor, ingresa tu *número de DNI*: 🆔");
        userState.step ='esperando_dni';
      }else{
        await sendMessage('Entiendo que no estes listo. Cuando quieras comenzar, solo escribe *SI*. Estaré aquí para ayudarte en cualquier momento');
      }
    },
    inicio: async () => {
      await sendMessage("¡Perfecto! 🎉 Vamos a avanzar con tu solicitud.\n\nPor favor, ingresa tu *número de DNI*: 🆔");
      userState.step = 'esperando_dni';
    },
    esperando_dni: async () => {
      let dni = getSafeMessageBody();
    
      if (dni.length === 8 && /^\d+$/.test(dni)) {
        try {
          const datosSocio = await verificarNumeroDNI(dni);
          console.log(datosSocio);
    
          if (datosSocio.success) {
            // DNI exists in local database
            userState.dni = dni;
            userState.datosSocio = datosSocio;
            await client.sendText(
              message.from,
              `Hola Sr(a) *${datosSocio.data.datos.nombres.trim()}* hemos encontrado un registro suyo.\n\nPor favor, confirma si es correcto respondiendo *Correcto* o *Act* para actualizar tus datos.`
            );
            userState.step = 'actualizar';
          } else {
            // DNI doesn't exist in local database, proceed to validate with Reniec
            const resultado = await consultarDNI(dni);
    
            if (resultado?.error === 'DNI_NOT_FOUND') {
              await sendMessage('No se encontró información para el DNI proporcionado. Por favor, verifica el número e intenta nuevamente.');
              return;
            }
    
            if (!resultado || !isValidValue(resultado.apellido_paterno)) {
              await sendMessage('No se pudo obtener la información completa. Por favor, intenta nuevamente más tarde.');
              return;
            }
    
            userState.dni = dni;
            userState.datosReniec = resultado;
            await sendMessage(`Según nuestros registros, tu *apellido paterno* es: *${resultado.apellido_paterno}*.\n\nPor favor, confirma si es correcto respondiendo *Sí* o *No*.`);
            userState.step = 'confirmar_apellido';
          }
        } catch (error) {
          console.error('Error al consultar DNI:', error);
          await sendMessage('Hubo un problema al verificar tu DNI. Por favor, intenta nuevamente más tarde.');
        }
      } else {
        await sendMessage('Por favor, ingresa un *DNI* válido (8 dígitos numéricos).');
      }
    }, 
    actualizar: async () => {
      const rpta = message.body.trim().toLowerCase();
    
      if (rpta === 'actualizar' || rpta === 'act') {
        await client.sendText(
          message.from,
          'MENU *estado civil*: \n1️⃣ *Casado(a)* 💍\n2️⃣ *Conviviente* 🤝\n3️⃣ *Divorciado(a)* 🔄\n4️⃣ *Separado(a)* ↔️\n5️⃣ *Soltero(a)*\n6️⃣ *Viudo(a)*'
        );
        userState.step = 'actualizar_Estado_Civil';
      } else if (
        rpta === 'correcto' || 
        rpta === 'ok' || 
        rpta === 'si' || 
        rpta === 'sí' || 
        rpta === 'correct' || 
        rpta === 'ver'
      ) {
        const datosGuardados = userState.datosSocio.data;
        await client.sendText(
          message.from,
          `Estos son tus datos\n\n *Edad*: ${datosGuardados.edad}🎂\n *Estado_Civil*: ${dicc.estado_civil[datosGuardados.estado_civil]}\n *Giro*: ${dicc.ocupacion[datosGuardados.giro]}\n *Frecuencia*: ${dicc.frecuencia[datosGuardados.frecuencia]}, \n¿Es correcto?`
        );
        userState.step = 'obtener_riesgo';
      } else{
              await client.sendText(message.from, 'Ingrese una opción válida, *ok* para confirmar *act* para actualizar')
      } 
    },
    actualizar_Estado_Civil: async ()=>{
          if (['1', '2', '3', '4', '5', '6'].includes(message.body.trim())) {
          userState.estado_civil = message.body.trim();
          await client.sendText(message.from, 'Selecciona tu *ocupación*:\n1️⃣ ABARROTES 🛒\n2️⃣ AUTOMOTRIZ 🚗\n3️⃣ BOTICA 💊\n4️⃣ CARPINTERÍA 🪚\n5️⃣ COMERCIANTE 🏪\n6️⃣ COMERCIO DE ALIMENTOS 🥗\n7️⃣ COMERCIO DE ANIMALES 🐾\n8️⃣ COMERCIO DE ARTESANÍA 🎨\n9️⃣ COMERCIO DE BEBIDAS 🥤\n🔟 COMERCIO DE CELULARES 📱\n1️⃣1️⃣ COMERCIO DE PROD. NO ALIMENTICIOS 🛍️\n1️⃣2️⃣ COMERCIO DE ROPA 👕\n1️⃣3️⃣ COMERCIO FERRETERO 🧰\n1️⃣4️⃣ COMERCIO MINORista 🏬\n1️⃣5️⃣ OFICIO 🧑‍🔧\n1️⃣6️⃣ OFICIO CONSTRUCCIÓN 🏗️\n1️⃣7️⃣ OTROS 🌐\n1️⃣8️⃣ PRESTADOR DE SERVICIOS 📑\n1️⃣9️⃣ PROFESIONAL 👔\n2️⃣0️⃣ RESTAURANTE 🍽️');
          userState.step = 'actualizar_giro';
        } else {
          await client.sendText(message.from, 'Por favor, selecciona una opción válida entre 1️⃣ y 6️⃣.');
        }    
    },

   actualizar_giro : async ()=>{
          if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'].includes(message.body.trim())) {
          userState.giro = message.body.trim();
          await client.sendText(message.from, '¿Cómo prefieres pagar tus cuotas? 💰\n1️⃣ *Meses* 📅\n2️⃣ *Semanas* 📆');
          userState.step = 'actualizar_frecuencia';
        } else {
          await client.sendText(message.from, 'Por favor, selecciona una opción válida entre 1️⃣ y 2️⃣0️⃣.');
        }
   },
   actualizar_frecuencia: async ()=>{
    if (['1', '2'].includes(message.body.trim())) {
     userState.frecuencia = message.body.trim();

     // Llamar a la API para obtener el perfil de riesgo
     const perfilRiesgo = await GetPerfilRiesgoSocio(userState.datosSocio.data.edad, userState.estado_civil, userState.giro, userState.frecuencia, userState.datosSocio.data.sexo);
     console.log(perfilRiesgo);
     actualizarDatos(userState.dni, userState.estado_civil,userState.giro, userState.frecuencia, perfilRiesgo.puntaje, perfilRiesgo.score);
     await client.sendText(message.from, 'Tus datos han sido actualizados, recarga para obtener tu score crediticio');
     userState.processoCompletado = true;
    } else {
    await client.sendText(message.from, 'Por favor, selecciona una opción válida:\n1️⃣ *Meses* 📅\n2️⃣ *Semanas* 📆');
    }
},

  confirmar_apellido: async () => {
    const confirmacion = getSafeMessageBody().toLowerCase();
    if (confirmacion === 'sí' || confirmacion === 'si') {
      const { nombres, apellido_paterno, apellido_materno } = userState.datosReniec;
      if (isValidValue(nombres) && isValidValue(apellido_paterno) && isValidValue(apellido_materno)) {
        await sendMessage(`Gracias por confirmar. Tus datos completos son:\n\nNombres: *${nombres.trim()}*\nApellido Paterno: *${apellido_paterno.trim()}*\nApellido Materno: *${apellido_materno.trim()}*\n\nAhora, por favor dime tu *edad*: 🎂`);
        userState.step = 'esperando_edad';
      } else {
        await sendMessage('Lo siento, parece que hay un problema con tus datos. Por favor, intenta nuevamente más tarde.');
        reiniciarEstadoUsuario(userState);
      }
    } else if (confirmacion === 'no') {
      await sendMessage('Por favor, ingresa nuevamente tu *DNI* correctamente: 🆔');
      userState.step = 'esperando_dni';
    } else {
      await sendMessage('Por favor, responde *Sí* o *No* para confirmar tu apellido.');
    }
  },
  esperando_edad: async () => {
    const edad = parseInt(getSafeMessageBody());
    if (!isNaN(edad) && edad > 0) {
      if (edad >= 23 && edad <= 65) {
        userState.edad = edad;
        await sendMessage('Selecciona tu *sexo*:\n1️⃣ *Femenino*\n2️⃣ *Masculino*');
        userState.step = 'esperando_sexo';
      } else {
        await sendMessage(edad < 23 ? 'Lo sentimos, aún no calificas para este servicio. La edad mínima requerida es 23 años.' : 'Lo sentimos, no cumples con los requisitos de edad para este servicio. La edad máxima permitida es 65 años.');
        await sendMessage('¿Deseas intentar nuevamente con otro DNI? Responde *Sí* para reiniciar o *No* para terminar.');
        userState.step = 'reiniciar_o_terminar';
      }
    } else {
      await sendMessage('Por favor, ingresa una *edad* válida en números.');
    }
  },
  reiniciar_o_terminar: async () => {
    const respuesta = message.body.trim().toLowerCase();
    if (respuesta === 'sí' || respuesta === 'si') {
      await sendMessage("Vamos a empezar de nuevo. Por favor, ingresa tu *número de DNI*: 🆔");
      userState.step = 'esperando_dni';
    } else if (respuesta === 'no') {
      await sendMessage("Gracias por tu interés. Si en el futuro cumples con los requisitos, no dudes en contactarnos nuevamente.");
      userState.step = 'inicio';
    } else {
      await sendMessage('Por favor, responde *Sí* para reiniciar o *No* para terminar.');
    }
  },
  esperando_sexo: async () => {
    if (['1', '2'].includes(message.body.trim())) {
      userState.sexo = message.body.trim();
      await sendMessage('Ahora, selecciona tu *estado civil*:\n1️⃣ *Casado(a)* 💍\n2️⃣ *Conviviente* 🤝\n3️⃣ *Divorciado(a)* 🔄\n4️⃣ *Separado(a)* ↔️\n5️⃣ *Soltero(a)*\n6️⃣ *Viudo(a)*');
      userState.step = 'esperando_estado_civil';
    } else {
      await sendMessage('Por favor, selecciona una opción válida:\n1️⃣ *Femenino*\n2️⃣ *Masculino*');
    }
  },
  esperando_estado_civil: async () => {
    if (['1', '2', '3', '4', '5', '6'].includes(message.body.trim())) {
      userState.estado_civil = message.body.trim();
      await sendMessage('Selecciona tu *ocupación*:\n1️⃣ ABARROTES 🛒\n2️⃣ AUTOMOTRIZ 🚗\n3️⃣ BOTICA 💊\n4️⃣ CARPINTERÍA 🪚\n5️⃣ COMERCIANTE 🏪\n6️⃣ COMERCIO DE ALIMENTOS 🥗\n7️⃣ COMERCIO DE ANIMALES 🐾\n8️⃣ COMERCIO DE ARTESANÍA 🎨\n9️⃣ COMERCIO DE BEBIDAS 🥤\n🔟 COMERCIO DE CELULARES 📱\n1️⃣1️⃣ COMERCIO DE PROD. NO ALIMENTICIOS 🛍️\n1️⃣2️⃣ COMERCIO DE ROPA 👕\n1️⃣3️⃣ COMERCIO FERRETERO 🧰\n1️⃣4️⃣ COMERCIO MINORista 🏬\n1️⃣5️⃣ OFICIO 🧑‍🔧\n1️⃣6️⃣ OFICIO CONSTRUCCIÓN 🏗️\n1️⃣7️⃣ OTROS 🌐\n1️⃣8️⃣ PRESTADOR DE SERVICIOS 📑\n1️⃣9️⃣ PROFESIONAL 👔\n2️⃣0️⃣ RESTAURANTE 🍽️');
      userState.step = 'esperando_giro';
    } else {
      await sendMessage('Por favor, selecciona una opción válida entre 1️⃣ y 6️⃣.');
    }
  },
  
  esperando_giro: async () => {
    if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'].includes(message.body.trim())) {
      userState.giro = message.body.trim();
      await sendMessage('¿Cómo prefieres pagar tus cuotas? 💰\n1️⃣ *Meses* 📅\n2️⃣ *Semanas* 📆');
      userState.step = 'esperando_frecuencia';
    } else {
      await sendMessage('Por favor, selecciona una opción válida entre 1️⃣ y 2️⃣0️⃣.');
    }
  },
  obtener_riesgo: async () => {
    console.log('Entrando al caso final');
    const respuesta = message.body.trim().toLowerCase();
  
    if (respuesta === 'no') {
      await client.sendText(
        message.from,
        'Ups🧑‍🔧, \nNo te preocupes, recalcularemos tu score crediticio. Por favor, ingresa tus nuevos datos correctamente.'
      );
      await client.sendText(
        message.from,
        'MENU *estado civil*: \n1️⃣ *Casado(a)* 💍\n2️⃣ *Conviviente* 🤝\n3️⃣ *Divorciado(a)* 🔄\n4️⃣ *Separado(a)* ↔️\n5️⃣ *Soltero(a)*\n6️⃣ *Viudo(a)*'
      );
      userState.step = 'actualizar_Estado_Civil';
    } else {
      await client.sendText(message.from, `Gracias por confiar en nosotros🫡`);
      await client.sendText(
        message.from,
        `Su *score crediticio* es: *${userState.datosSocio.data.puntaje}* 📊\n\n y su *Calificación* es de: *${userState.datosSocio.data.score}*`
      );
      userState.processoCompletado = true;
    }
  },
  esperando_frecuencia: async () => {
    const frecuencia = getSafeMessageBody();
    if (['1', '2'].includes(frecuencia)) {
      userState.frecuencia = frecuencia;
      
      // Verificar que todos los datos necesarios estén presentes
      const datosNecesarios = [userState.edad, userState.estado_civil, userState.giro, userState.frecuencia, userState.sexo];
      if (datosNecesarios.every(isValidValue)) {
        const perfilRiesgo = await GetPerfilRiesgoSocio(userState.edad, userState.estado_civil, userState.giro, userState.frecuencia, userState.sexo);
        
        if (perfilRiesgo && isValidValue(perfilRiesgo.puntaje)) {
          await sendMessage(`Tu *score crediticio* es: *${perfilRiesgo.puntaje.toFixed(3)}* 📊`);
          await sendMessage(`Calificación: *${perfilRiesgo.score}*`);

        if (perfilRiesgo.score === 'Bueno') {
          await sendMessage('¡Felicitaciones! Tienes una alta posibilidad de acceder al crédito. Un asesor financiero se comunicará contigo pronto. 📞');
        } else if (perfilRiesgo.score === 'Regular') {
          await sendMessage('Tienes una posibilidad moderada de acceder al crédito. Un asesor financiero se comunicará contigo para discutir tus opciones. 📞');
        } else {
          await sendMessage('Lo sentimos, tu *score* no es favorable. Sin embargo, un asesor financiero se comunicará contigo para explorar otras opciones. 📞');
        }
        const datosUsuario = {
          CELULAR: 'proof_number', //message.from
          DNI_CONSULTADO: 'proof_ID', //userState.dni
          NOM_FRECUENCIA: userState.frecuencia,
          EDAD: parseInt(userState.edad),
          SEXO: userState.sexo,
          ESTADO_CIVIL: userState.estado_civil,
          GIRO: userState.giro
        };
        const date = new Date(userState.lastActivity);
        fecha = formatDate(date);
        hora = formatTime(date)
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

          const datosValidos = Object.fromEntries(
            Object.entries(datosUsuario).filter(([_, valor]) => isValidValue(valor))
          );
          
          if (Object.keys(datosValidos).length > 0) {
            await enviarDatosUsuario(datosValidos);
            /*const mensajeDatos = Object.entries(datosValidos)
              .map(([clave, valor]) => `${clave}: ${valor}`)
              .join('\n');
            await sendMessage(`Datos registrados:\n${mensajeDatos}`);*/
          } else {
            console.log('No hay datos válidos para enviar.');
            await sendMessage('Lo siento, hubo un problema al procesar tus datos. Por favor, intenta nuevamente más tarde.');
            reiniciarEstadoUsuario(userState);
          }

          await sendMessage('Gracias por completar el proceso. Si necesitas algo más, no dudes en contactarnos nuevamente.');
          userState.processoCompletado = true;
        } else {
          await sendMessage('Hubo un problema al obtener tu perfil de riesgo. Por favor, inténtalo nuevamente más tarde.');
          reiniciarEstadoUsuario(userState);
        }
      } else {
        await sendMessage('Lo siento, parece que falta información importante. Vamos a comenzar de nuevo.');
        reiniciarEstadoUsuario(userState);
      }
    } else {
      await sendMessage('Por favor, selecciona una opción válida:\n1️⃣ *Meses* 📅\n2️⃣ *Semanas* 📆');
    }
  }
};

if (handleSteps[userState.step]) {
  await handleSteps[userState.step]();
} else {
  reiniciarEstadoUsuario(userState);
  await sendMessage('Bienvenido. Vamos a calcular tu perfil de riesgo.');
  await handleUserInput(client, message, userState);
}
};

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

const TIMEOUT = 2 * 60 * 1000;
const WARNING_TIME = 1 * 60 * 1000;
  
function start(client) {
  client.onMessage(async (message) => {
    console.log('Mensaje recibido:', message.body);
  
    let userState = userStates[message.from] || { 
      step: 'bienvenida', 
      lastActivity: Date.now(), 
      warningShown: false, 
      expirationShown: false, 
      processoCompletado: false,
      reportState: null
    };
  
    userStates[message.from] = userState;
    userState.lastActivity = Date.now();
  
    const messageBody = message.body?.toLowerCase().trim() || '';
  
    if (messageBody === 'reporte' || userState.reportState) {
      if (!userState.reportState) {
        userState.reportState = { step: 'inicio_reporte' };
      }
      const reporteCompletado = await handleReportCommand(client, message, userState.reportState);
      if (reporteCompletado) {
        userState.reportState = null;
      }
    } else if (['hola', 'hello', 'hi', 'hey', 'inicio', 'empezar'].includes(messageBody) || userState.processoCompletado) {
      reiniciarEstadoUsuario(userState);
      await handleRegularConversation(client, message, userState);
    } else {
      await handleRegularConversation(client, message, userState);
    }
  
    console.log('Estado final del usuario:', userStates[message.from]);
  });
  
  setInterval(() => checkInactiveSessions(client), WARNING_TIME);
};
  
async function handleRegularConversation(client, message, userState) {
  if (userState.step === 'bienvenida') {
    await sendWelcomeMessage(client, message.from);
    userState.step = 'confirmacion_inicio';
  } else {
    await handleUserInput(client, message, userState);
  }
};

// Función para enviar mensaje de bienvenida
async function sendWelcomeMessage(client, to) {
  await client.sendText(to,
    "¡Hola! 👋✨ Soy *ESTRELLA* ✨, tu asistente para conseguir el crédito digital que necesitas, ¡rápido y sin complicaciones! 💸\n\n" +
    "⚠️ *Antes de comenzar, es importante que sepas:* ⚠️\n\n" +
    "🔹 *Este crédito está dirigido principalmente a personas no bancarizadas o sin historial crediticio.* 📊\n\n" +
    "🔹 *Si tienes cuenta de crédito, debes estar al día en tus pagos en los últimos 3 meses.* 🕒\n\n" +
    "🔹 *Si tienes cuentas de crédito en más de 3 entidades, no calificarás.* ❌\n\n" +
    "🔹 *Toda la información que proporciones será verificada, así que es crucial que sea verídica. Datos incorrectos resultarán en el rechazo de la solicitud.* ✅\n\n" +
    "Si cumples con estos requisitos, me gustaría conocerte un poco mejor. 😊\n\n" +
    "¿Estás listo para empezar? Responde con *SÍ* y comenzamos. 👍"
  );
};

// Función para reiniciar el estado del usuario
function reiniciarEstadoUsuario(userState) {
  userState.step = 'bienvenida';
  userState.lastActivity = Date.now();
  userState.warningShown = false;
  userState.expirationShown = false;
  userState.processoCompletado = false;
  userState.reportState = null;
};

// Función para verificar sesiones inactivas
function checkInactiveSessions(client) {
  const now = Date.now();
  Object.entries(userStates).forEach(([userId, state]) => {
    if (!state.processoCompletado) {
      const inactiveTime = now - state.lastActivity;
      if (inactiveTime > WARNING_TIME && inactiveTime <= TIMEOUT && !state.warningShown) {
        client.sendText(userId, `¿Sigues ahí? Tu sesión se cerrará por inactividad en ${Math.ceil((TIMEOUT - inactiveTime) / 60000)} minuto(s). Si quieres continuar, digita tu respuesta.`);
        state.warningShown = true;
      } else if (inactiveTime > TIMEOUT && !state.expirationShown) {
        client.sendText(userId, "Tu sesión ha expirado por inactividad. Por favor, escribe 'hola' para comenzar de nuevo cuando estés listo.");
        reiniciarEstadoUsuario(state);
        state.expirationShown = true;
      }
    }
  });
};


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
