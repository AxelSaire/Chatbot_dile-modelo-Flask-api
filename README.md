
# Chatbot de Evaluación de Riesgo Crediticio con WhatsApp

Este proyecto implementa un chatbot de WhatsApp utilizando Venom-bot para realizar evaluaciones de riesgo crediticio. El bot guía a los usuarios a través de una serie de preguntas para recopilar información y luego calcula un perfil de riesgo crediticio utilizando un modelo de aprendizaje automático.

## Características principales

>>Recopilación de datos del usuario paso a paso
>>Cálculo del perfil de riesgo crediticio utilizando un modelo XGBoost
>>Almacenamiento de datos de usuarios en MongoDB
>>API Flask para el procesamiento del modelo de riesgo

## Requisitos previos

Node.js (versión 12 o superior)

Python 3.7+

MongoDB

NPM (Node Package Manager)

## Instalación
#### Configura tu base de datos MongoDB (asegúrate de que MongoDB esté ejecutándose en tu sistema).
>npm install venom-bot axios mongoose

>npm install -g concurrently

#### Instala las dependencias de Python:

> pip install pandas xgboost flask


### Configuración

Asegúrate de tener los modelos XGBoost entrenados (modelo_dias.json, modelo_meses.json, modelo_semanas.json) en el directorio raíz.
Configura las variables de entorno necesarias 

# Uso
> npm start

> python app.py


Escanea el código QR que aparece en la consola con tu WhatsApp para iniciar sesión.
El bot ahora está listo para interactuar con los usuarios a través de WhatsApp.

## Flujo de la conversación

El bot saluda al usuario y pide confirmación para comenzar la evaluación.
Se solicita al usuario información como DNI, edad, tipo de vivienda, estado civil, ocupación y frecuencia de pago preferida.
Con esta información, se calcula el perfil de riesgo crediticio utilizando el modelo XGBoost.
Se muestra al usuario su puntuación y calificación de riesgo.
Los datos del usuario se almacenan en MongoDB para futuras referencias.

## Estructura del proyecto

index.js: Lógica principal del bot de WhatsApp

app.py: API Flask para el procesamiento del modelo de riesgo
Contiene los modelos XGBoost

sessions/: Directorio para almacenar las sesiones de WhatsApp

## Contribuciones
Las contribuciones son bienvenidas. Por favor, abre un issue para discutir cambios importantes antes de crear un pull request.