import pandas as pd
import xgboost as xgb
from flask import Flask, request, jsonify

app = Flask(__name__)

# Carga tus modelos de riesgo de crédito
modelos = {
    'DIARIA': xgb.Booster(),
    'MENSUAL': xgb.Booster(),
    'SEMANAL': xgb.Booster()
}

modelos['DIARIA'].load_model('modelo_dias.json')
modelos['MENSUAL'].load_model('modelo_meses.json')
modelos['SEMANAL'].load_model('modelo_semanas.json')

def prepare_input_data(data):
    # Lista de todas las características que el modelo espera
    expected_features = [
        "CUOTA_FIJA", "TEA_INTERES", "EDAD", 
        "TIPO_VIVIENDA_ALQUILADA", "TIPO_VIVIENDA_FAMILIAR", "TIPO_VIVIENDA_PROPIA",
        "ESTADO_CIVIL_Casado (a)", "ESTADO_CIVIL_Conviviente", "ESTADO_CIVIL_Divorciado (a)",
        "ESTADO_CIVIL_Separado (a)", "ESTADO_CIVIL_Soltero (a)", "ESTADO_CIVIL_Viudo (a)",
        "GIROS_ABARROTES", "GIROS_AUTOMOTRIZ", "GIROS_BOTICA", "GIROS_CARPINTERIA",
        "GIROS_COMERCIANTE", "GIROS_COMERCIO DE ALIMENTOS", "GIROS_COMERCIO DE ANIMALES",
        "GIROS_COMERCIO DE ARTESANIA", "GIROS_COMERCIO DE BEBIDAS", "GIROS_COMERCIO DE CELULARES",
        "GIROS_COMERCIO DE PROD NO ALIMENTICIOS", "GIROS_COMERCIO DE ROPA", "GIROS_COMERCIO FERRETERO",
        "GIROS_COMERCIO MINORISTA", "GIROS_OFICIO", "GIROS_OFICIO CONSTRUCCION", "GIROS_OTROS",
        "GIROS_PRESTADOR DE SERVICIOS", "GIROS_PROFESIONAL", "GIROS_RESTAURANTE"
    ]
    
    # Crear un diccionario con todas las características inicializadas a 0
    prepared_data = {feature: 0 for feature in expected_features}
    
    # Actualizar con los valores proporcionados
    prepared_data['EDAD'] = data.get('EDAD', 0)
    prepared_data['CUOTA_FIJA'] = data.get('CUOTA_FIJA', 0)  # asume un valor por defecto si no se proporciona
    prepared_data['TEA_INTERES'] = data.get('TEA_INTERES', 0)  # asume un valor por defecto si no se proporciona
    
    # Crear variables dummy para TIPO_VIVIENDA
    tipo_vivienda = data.get('TIPO_VIVIENDA', '').upper()
    if tipo_vivienda in ['ALQUILADA', 'FAMILIAR', 'PROPIA']:
        prepared_data[f'TIPO_VIVIENDA_{tipo_vivienda}'] = 1
    
    # Crear variables dummy para ESTADO_CIVIL
    estado_civil = data.get('ESTADO_CIVIL', '')
    if estado_civil in ['Casado (a)', 'Conviviente', 'Divorciado (a)', 'Separado (a)', 'Soltero (a)', 'Viudo (a)']:
        prepared_data[f'ESTADO_CIVIL_{estado_civil}'] = 1
    
    # Crear variables dummy para GIRO
    giro = data.get('GIRO', '').upper().replace(' ', '_')
    if f'GIROS_{giro}' in expected_features:
        prepared_data[f'GIROS_{giro}'] = 1
    
    # Convertir a DataFrame
    df = pd.DataFrame([prepared_data])
    
    # Asegurarse de que todas las columnas estén presentes y en el orden correcto
    df = df[expected_features]
    
    return df

def categorize_score(puntaje, frecuencia):
    if frecuencia == 'MENSUAL':
        if 0 <= puntaje <= 0.25:
            return 'Muy Bueno'
        elif 0.25 < puntaje <= 0.35:
            return 'Bueno'
        elif 0.35 < puntaje <= 0.5:
            return 'Regular'
        else:
            return 'Malo'
    elif frecuencia == 'SEMANAL':
        if 0 <= puntaje <= 0.35:
            return 'Bueno'
        elif 0.35 < puntaje <= 0.5:
            return 'Regular'
        else:
            return 'Malo'
    elif frecuencia == 'DIARIA':
        if 0 <= puntaje <= 0.2:
            return 'Muy Bueno'
        elif 0.2 < puntaje <= 0.35:
            return 'Bueno'
        elif 0.35 < puntaje <= 0.5:
            return 'Regular'
        else:
            return 'Malo'
    else:
        return 'Desconocido'

@app.route('/api/predict', methods=['POST'])
def predict():
    if request.is_json:
        data = request.get_json()
        
        frecuencia = data.pop('NOM_FRECUENCIA', 'MENSUAL').upper()
        if frecuencia not in modelos:
            return jsonify({"error": "Frecuencia no válida"}), 400
        
        df_usuario = prepare_input_data(data)
        
        modelo = modelos[frecuencia]
        
        dmatrix_usuario = xgb.DMatrix(df_usuario)
        prediccion = modelo.predict(dmatrix_usuario)
        
        puntaje = float(prediccion[0])
        puntaje_complemento = (1000 - puntaje*1000)  # Calculamos el complemento
        categoria = categorize_score(puntaje, frecuencia)
        
        resultado = {
            'puntaje': puntaje, #puntaje,
            'puntaje_complemento': puntaje_complemento,  
            'score': categoria
        }
        
        return jsonify(resultado)
    else:
        return jsonify({"error": "El tipo de contenido debe ser application/json"}), 415

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)