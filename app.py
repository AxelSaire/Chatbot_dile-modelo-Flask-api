import pandas as pd
import xgboost as xgb
from flask import Flask, request, jsonify

app = Flask(__name__)

# Carga el modelo general
modelo = xgb.Booster()
modelo.load_model('modelo_general.json')

def prepare_input_data(data):
    # Mapeos para convertir números a texto
    frecuencia_map = {'1': 'MESES', '2': 'SEMANAS'}
    sexo_map = {'1': 'F', '2': 'M'}
    estado_civil_map = {
        '1': 'Casado (a)',
        '2': 'Conviviente',
        '3': 'Divorciado (a)',
        '4': 'Separado (a)',
        '5': 'Soltero (a)',
        '6': 'Viudo (a)'
    }
    giro_map = {
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
    }

    # Convertir los datos de entrada numéricos a su representación de texto
    text_data = {
        'EDAD': data.get('EDAD', 0),
        'NOM_FRECUENCIA': frecuencia_map.get(str(data.get('NOM_FRECUENCIA', '')), ''),
        'SEXO': sexo_map.get(str(data.get('SEXO', '')), ''),
        'ESTADO_CIVIL': estado_civil_map.get(str(data.get('ESTADO_CIVIL', '')), ''),
        'GIROS': giro_map.get(str(data.get('GIRO', '')), '')
    }

    # Lista de todas las características que el modelo espera, en el orden correcto
    expected_features = [
        "EDAD", "NOM_FRECUENCIA_MESES", "NOM_FRECUENCIA_SEMANAS", "SEXO_F", "SEXO_M",
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
    prepared_data['EDAD'] = text_data['EDAD']
    
    # Crear variables dummy para NOM_FRECUENCIA
    if text_data['NOM_FRECUENCIA'] == 'MESES':
        prepared_data['NOM_FRECUENCIA_MESES'] = 1
    elif text_data['NOM_FRECUENCIA'] == 'SEMANAS':
        prepared_data['NOM_FRECUENCIA_SEMANAS'] = 1
    
    # Crear variables dummy para SEXO
    if text_data['SEXO'] == 'F':
        prepared_data['SEXO_F'] = 1
    elif text_data['SEXO'] == 'M':
        prepared_data['SEXO_M'] = 1
    
    # Crear variables dummy para ESTADO_CIVIL
    if text_data['ESTADO_CIVIL']:
        prepared_data[f'ESTADO_CIVIL_{text_data["ESTADO_CIVIL"]}'] = 1
    
    # Crear variables dummy para GIRO
    if text_data['GIROS']:
        prepared_data[f'GIROS_{text_data["GIROS"]}'] = 1
    
    # Convertir a DataFrame
    df = pd.DataFrame([prepared_data])
    
    # Asegurarse de que todas las columnas estén presentes y en el orden correcto
    df = df[expected_features]
    
    return df

def categorize_score(puntaje):
    if 0 <= puntaje < 505:
        return 'Malo'
    elif 505<= puntaje < 662.6:
        return 'Regular'
    else:
        return 'Bueno'

@app.route('/api/predict', methods=['POST'])
def predict():
    if request.is_json:
        data = request.get_json()
        
        df_usuario = prepare_input_data(data)
        
        dmatrix_usuario = xgb.DMatrix(df_usuario)
        prediccion = modelo.predict(dmatrix_usuario)
        
        puntaje = float(prediccion[0])
        puntaje_escalado = 1000 - puntaje * 1000  # Escalamos el puntaje a un rango de 0 a 1000
        categoria = categorize_score(puntaje_escalado)
        
        resultado = {
            'puntaje': puntaje_escalado,
            'score': categoria
        }
        
        return jsonify(resultado)
    else:
        return jsonify({"error": "El tipo de contenido debe ser application/json"}), 415

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)