// ============================================================
// CalD Risk Screen — Diccionario de datos (nuevo en la v6.0)
// ============================================================
//
// POR QUÉ EXISTE ESTE ARCHIVO
//
// La v3.1 exportaba unas sesenta columnas con nombres en castellano sin
// acentos y sin definición, unidad ni codificación de los valores
// categóricos. Quien importara ese CSV en SPSS o en R tenía que inferir
// qué era `razonAdecuacionNeta` o qué significaban los niveles de
// `nivelSodio`. Un diccionario de datos no es burocracia: es el
// documento que permite que otra persona —o el propio autor dieciocho
// meses después— analice el archivo sin adivinar.
//
// Cada campo declara nombre, etiqueta, tipo, unidad, rango válido,
// codificación de los valores categóricos y ORIGEN: si lo captura el
// evaluador, si lo calcula el motor o si es una columna del patrón de
// oro que se rellena desde fuera.
//
// El diccionario se exporta en dos formatos: CSV plano para adjuntar
// como material suplementario, y el formato de importación de
// diccionarios de REDCap, para quien monte la base allí.
//
// © Jean Carlos Ruiz Mosley. Todos los derechos reservados.
// ============================================================

// Tipos: 'texto' | 'entero' | 'decimal' | 'categorico' | 'logico' | 'fecha'
// Origen: 'capturado' (lo introduce el evaluador)
//         'calculado'  (lo produce el motor CARDA)
//         'patron_oro' (se rellena desde la fuente externa de referencia)
//         'trazabilidad' (identifica la versión que produjo la fila)

const DICCIONARIO_DATOS = [
    // --- Identificación y trazabilidad ---
    { campo: 'codigo', etiqueta: 'Código del participante', tipo: 'texto', origen: 'capturado',
      nota: 'Identificador seudonimizado. No debe contener nombre ni documento de identidad.' },
    { campo: 'fecha', etiqueta: 'Fecha de la evaluación', tipo: 'fecha', origen: 'capturado' },
    { campo: 'motorVersion', etiqueta: 'Versión del motor CARDA', tipo: 'texto', origen: 'trazabilidad',
      nota: 'Sin este campo, las filas recogidas antes y después de ajustar un parámetro quedan mezcladas sin forma de distinguirlas.' },
    { campo: 'motorHuella', etiqueta: 'Huella del conjunto de parámetros', tipo: 'texto', origen: 'trazabilidad',
      nota: 'Cambia si se modifica cualquier constante del modelo. Permite separar subconjuntos si se recalibra a mitad del estudio.' },

    // --- Antropometría y perfil ---
    { campo: 'edad', etiqueta: 'Edad', tipo: 'entero', unidad: 'años', rangoValido: '18-100', origen: 'capturado' },
    { campo: 'sexo', etiqueta: 'Sexo', tipo: 'categorico', origen: 'capturado',
      codificacion: 'femenino | masculino' },
    { campo: 'pesoKg', etiqueta: 'Peso corporal', tipo: 'decimal', unidad: 'kg', rangoValido: '30-250', origen: 'capturado' },
    { campo: 'tallaCm', etiqueta: 'Talla', tipo: 'decimal', unidad: 'cm', rangoValido: '120-220', origen: 'capturado' },
    { campo: 'imc', etiqueta: 'Índice de masa corporal', tipo: 'decimal', unidad: 'kg/m²', origen: 'calculado',
      nota: 'peso / talla². En la v6.0 alimenta el ajuste de la meta de vitamina D y el ajuste de la circunferencia de pantorrilla.' },
    { campo: 'imcCategoria', etiqueta: 'Categoría de IMC (OMS)', tipo: 'categorico', origen: 'calculado',
      codificacion: 'bajo_peso | normal | sobrepeso | obesidad_1 | obesidad_2 | obesidad_3' },
    { campo: 'patronDietetico', etiqueta: 'Patrón dietético del estudio', tipo: 'categorico', origen: 'capturado',
      codificacion: 'omnivoro | ovolactovegetariano | vegano | flexitariano' },

    // --- Calcio ---
    { campo: 'marcoReferencia', etiqueta: 'Marco de referencia de calcio', tipo: 'categorico', origen: 'capturado',
      codificacion: 'IOM | EFSA' },
    { campo: 'rdaCalcio', etiqueta: 'Ingesta de referencia de calcio aplicada', tipo: 'entero', unidad: 'mg/día', origen: 'calculado' },
    { campo: 'calcioIngeridoDia', etiqueta: 'Calcio ingerido', tipo: 'decimal', unidad: 'mg/día', origen: 'calculado',
      nota: 'Promedio de la semana virtual de 7 días × 3 comidas.' },
    { campo: 'calcioAbsorbidoDia', etiqueta: 'Calcio absorbido estimado', tipo: 'decimal', unidad: 'mg/día', origen: 'calculado',
      nota: 'Aplica la curva de saturación de Heaney a la carga de cada comida y la biodisponibilidad relativa de cada alimento.' },
    { campo: 'calcioAbsorbidoNetoDia', etiqueta: 'Calcio absorbido neto', tipo: 'decimal', unidad: 'mg/día', origen: 'calculado',
      nota: 'Absorbido menos la desviación de las pérdidas urinarias respecto a la ingesta de referencia. En la v6.0 puede ser MAYOR que el absorbido si el sodio declarado es inferior al de referencia.' },
    { campo: 'eficienciaAbsorcion', etiqueta: 'Eficiencia global de absorción', tipo: 'decimal', unidad: '%', origen: 'calculado' },
    { campo: 'razonAdecuacionCalcio', etiqueta: 'Adecuación de calcio absorbido', tipo: 'decimal', unidad: '%', origen: 'calculado' },
    { campo: 'razonAdecuacionNeta', etiqueta: 'Adecuación de calcio absorbido neto', tipo: 'decimal', unidad: '%', origen: 'calculado' },
    { campo: 'bajoUmbral525', etiqueta: 'Por debajo del umbral protector de EPIC-Oxford', tipo: 'logico', origen: 'calculado',
      codificacion: '0 = no | 1 = sí', nota: 'Umbral de 525 mg/día de calcio ingerido (Appleby et al. 2007).' },
    { campo: 'suplementoTipo', etiqueta: 'Tipo de suplemento de calcio', tipo: 'categorico', origen: 'capturado',
      codificacion: 'ninguno | carbonato | citrato | otro' },
    { campo: 'suplementoMgDia', etiqueta: 'Dosis declarada de calcio elemental', tipo: 'decimal', unidad: 'mg/día', origen: 'capturado' },
    { campo: 'momentoTomaSuplemento', etiqueta: 'Momento de la toma del suplemento', tipo: 'categorico', origen: 'capturado',
      codificacion: 'con_comida | ayuno',
      nota: 'Nuevo en la v6.0. Condiciona el factor de los inhibidores de la bomba de protones: el carbonato en ayuno se penaliza mucho más.' },
    { campo: 'calcioSupGenerico', etiqueta: 'Dosis de calcio tomada de valor genérico', tipo: 'logico', origen: 'capturado',
      codificacion: '0 = verificada con etiqueta | 1 = valor genérico' },
    { campo: 'usaIBP', etiqueta: 'Uso de inhibidor de la bomba de protones', tipo: 'logico', origen: 'capturado',
      codificacion: '0 = no | 1 = sí' },
    { campo: 'nivelSodio', etiqueta: 'Nivel de ingesta de sodio', tipo: 'categorico', origen: 'capturado',
      codificacion: 'bajo (1.5 g/día) | medio (3.0 g/día) | alto (5.0 g/día)' },
    { campo: 'tazasCafeDia', etiqueta: 'Tazas de café con cafeína', tipo: 'entero', unidad: 'tazas/día', origen: 'capturado' },
    { campo: 'perdidaCalcioDia', etiqueta: 'Desviación de las pérdidas urinarias', tipo: 'decimal', unidad: 'mg/día', origen: 'calculado',
      nota: 'v6.0: es la desviación respecto a la ingesta de referencia, NO la pérdida absoluta. Valores negativos indican consumo por debajo de la referencia.' },
    { campo: 'aguaTipo', etiqueta: 'Tipo de agua de consumo', tipo: 'categorico', origen: 'capturado',
      codificacion: 'no_declarada | blanda | media | dura | mineral_alta | personalizada' },
    { campo: 'aguaMgPorLitro', etiqueta: 'Concentración de calcio del agua', tipo: 'decimal', unidad: 'mg/L', origen: 'capturado' },
    { campo: 'aguaLitrosDia', etiqueta: 'Consumo de agua', tipo: 'decimal', unidad: 'L/día', origen: 'capturado' },
    { campo: 'aguaCalcioMgDia', etiqueta: 'Calcio aportado por el agua', tipo: 'decimal', unidad: 'mg/día', origen: 'calculado',
      nota: 'Nuevo en la v6.0. Fuente que los cuestionarios de frecuencia ignoran por sistema y que puede aportar 100-300 mg/día.' },

    // --- Vitamina D: ingesta ---
    { campo: 'vitDDietaMcgDia', etiqueta: 'Vitamina D dietética (equivalente D3)', tipo: 'decimal', unidad: 'µg/día', origen: 'calculado' },
    { campo: 'vitDSuplMcgDia', etiqueta: 'Vitamina D del suplemento (equivalente D3)', tipo: 'decimal', unidad: 'µg/día', origen: 'calculado',
      nota: 'La D2 se pondera por su menor potencia (Tripkovic et al. 2012).' },
    { campo: 'vitDTotalMcgDia', etiqueta: 'Vitamina D total ingerida (equivalente D3)', tipo: 'decimal', unidad: 'µg/día', origen: 'calculado' },
    { campo: 'vitDMeta', etiqueta: 'Meta de vitamina D sin ajustar', tipo: 'decimal', unidad: 'µg/día', origen: 'calculado' },
    { campo: 'vitDMetaAjustada', etiqueta: 'Meta de vitamina D ajustada por tamaño corporal', tipo: 'decimal', unidad: 'µg/día', origen: 'calculado',
      nota: 'Nuevo en la v6.0. Ajuste ORIENTATIVO por dilución volumétrica en el compartimento graso, limitado por el nivel máximo tolerable.' },
    { campo: 'vitDFactorTamano', etiqueta: 'Factor de ajuste por tamaño corporal', tipo: 'decimal', origen: 'calculado',
      codificacion: '1.0 | 1.5 | 2.0 | 2.5 según tramo de IMC' },
    { campo: 'vitDCategoria', etiqueta: 'Categoría de adecuación de vitamina D', tipo: 'categorico', origen: 'calculado',
      codificacion: 'baja | limitrofe | adecuada | excede_ul' },
    { campo: 'vitDSupGenerico', etiqueta: 'Dosis de vitamina D tomada de valor genérico', tipo: 'logico', origen: 'capturado',
      codificacion: '0 = verificada con etiqueta | 1 = valor genérico | vacío = sin suplemento',
      nota: 'En la v3.1 este campo se rellenaba con 1 incluso sin suplemento, por una condición mal escrita. Corregido en la v6.0.' },

    // --- Exposición solar ---
    { campo: 'fototipo', etiqueta: 'Fototipo de Fitzpatrick', tipo: 'categorico', origen: 'capturado',
      codificacion: 'I | II | III | IV | V | VI' },
    { campo: 'solarDiasSemana', etiqueta: 'Días de exposición solar', tipo: 'entero', unidad: 'días/semana', rangoValido: '0-7', origen: 'capturado' },
    { campo: 'solarMinutosSesion', etiqueta: 'Minutos de exposición por sesión', tipo: 'entero', unidad: 'min', origen: 'capturado' },
    { campo: 'solarSuperficie', etiqueta: 'Superficie corporal expuesta', tipo: 'categorico', origen: 'capturado',
      codificacion: 'minima (~10%) | parcial (~25%) | amplia (~50%)' },
    { campo: 'solarHorario', etiqueta: 'Franja horaria de la exposición', tipo: 'categorico', origen: 'capturado',
      codificacion: 'pico (10:00-16:00) | no_pico' },
    { campo: 'usaProtectorSolar', etiqueta: 'Uso de protector solar durante la exposición', tipo: 'logico', origen: 'capturado',
      codificacion: '0 = no | 1 = sí', nota: 'Nuevo en la v6.0: se modela como transmisión parcial, no como bloqueo total.' },
    { campo: 'fpsDeclarado', etiqueta: 'Factor de protección solar declarado', tipo: 'entero', origen: 'capturado' },
    { campo: 'latitud', etiqueta: 'Latitud del lugar de residencia', tipo: 'decimal', unidad: 'grados', rangoValido: '-90 a 90', origen: 'capturado',
      nota: 'Nuevo en la v6.0. Sin latitud y mes el índice UV cae al valor de reserva de la latitud de Panamá.' },
    { campo: 'mesEvaluacion', etiqueta: 'Mes de la evaluación', tipo: 'entero', rangoValido: '1-12', origen: 'capturado' },
    { campo: 'altitudMetros', etiqueta: 'Altitud del lugar de residencia', tipo: 'entero', unidad: 'm', origen: 'capturado' },
    { campo: 'indiceUVUsado', etiqueta: 'Índice UV empleado en el cálculo', tipo: 'decimal', origen: 'calculado' },
    { campo: 'procedenciaIndiceUV', etiqueta: 'Procedencia del índice UV', tipo: 'categorico', origen: 'calculado',
      codificacion: 'observado | modelo_cielo_claro | valor_tipico_panama',
      nota: 'Condiciona lo que vale la estimación de síntesis cutánea. Una fila con valor de reserva no es comparable con una medida.' },
    { campo: 'solarSedSemanal', etiqueta: 'Dosis eritematosa estándar semanal', tipo: 'decimal', unidad: 'SED', origen: 'calculado' },
    { campo: 'solarFraccionMED', etiqueta: 'Fracción de dosis eritematosa mínima por sesión', tipo: 'decimal', origen: 'calculado' },
    { campo: 'solarUIDia', etiqueta: 'Síntesis cutánea estimada', tipo: 'entero', unidad: 'UI/día', origen: 'calculado' },
    { campo: 'solarCategoria', etiqueta: 'Categoría de exposición solar', tipo: 'categorico', origen: 'calculado',
      codificacion: 'bajo | moderado | alto (riesgo)',
      nota: 'v6.0: derivada del equivalente en UI frente a la ingesta de referencia. Cortes HEURÍSTICOS pendientes de calibrar contra 25(OH)D.' },
    { campo: 'vitDTotalConSolUIDia', etiqueta: 'Entrada total estimada de vitamina D', tipo: 'entero', unidad: 'UI/día', origen: 'calculado',
      nota: 'Suma de dieta, suplemento y síntesis cutánea. NO comparable directamente con la ingesta de referencia, que se definió suponiendo exposición solar mínima.' },
    { campo: 'proporcionCutanea', etiqueta: 'Proporción de la entrada total que aporta la piel', tipo: 'decimal', unidad: '%', origen: 'calculado',
      nota: 'Un total dominado por la vía cutánea arrastra toda la incertidumbre del modelo fotobiológico.' },

    // --- Actividad física y sarcopenia ---
    { campo: 'ejercicioAerobicoHoras', etiqueta: 'Ejercicio aeróbico', tipo: 'decimal', unidad: 'h/semana', origen: 'capturado' },
    { campo: 'ejercicioFuerzaDias', etiqueta: 'Entrenamiento de fuerza', tipo: 'entero', unidad: 'días/semana', rangoValido: '0-7', origen: 'capturado' },
    { campo: 'sarcfPuntaje', etiqueta: 'Puntaje SARC-F', tipo: 'entero', rangoValido: '0-10', origen: 'calculado',
      nota: 'Cinco ítems de 0 a 2. Corte estándar ≥4 (específico); corte sensible ≥2.' },
    { campo: 'sarcCalFPuntaje', etiqueta: 'Puntaje SARC-CalF', tipo: 'entero', rangoValido: '0-20', origen: 'calculado',
      nota: 'Nuevo en la v6.0. SARC-F más 10 puntos si la circunferencia de pantorrilla está por debajo del corte. Corte ≥11 (Barbosa-Silva et al. 2016).' },
    { campo: 'sarcfCategoria', etiqueta: 'Categoría de riesgo de sarcopenia', tipo: 'categorico', origen: 'calculado',
      codificacion: 'bajo | alerta | riesgo' },
    { campo: 'pantorrillaCm', etiqueta: 'Circunferencia de pantorrilla medida', tipo: 'decimal', unidad: 'cm', origen: 'capturado' },
    { campo: 'pantorrillaAjustadaCm', etiqueta: 'Circunferencia de pantorrilla ajustada por IMC', tipo: 'decimal', unidad: 'cm', origen: 'calculado',
      nota: 'Nuevo en la v6.0. Ajuste de González et al. 2021: +4 cm si IMC<18.5, −3 si 25-30, −7 si ≥30.' },

    // --- Proteína ---
    { campo: 'proteinaGkg', etiqueta: 'Proteína bruta estimada', tipo: 'decimal', unidad: 'g/kg/día', origen: 'calculado' },
    { campo: 'proteinaUtilizableGkg', etiqueta: 'Proteína utilizable (ponderada por DIAAS)', tipo: 'decimal', unidad: 'g/kg/día', origen: 'calculado',
      nota: 'Nuevo en la v6.0. Se compara contra el objetivo SIN el factor de dieta vegetal, para no contar dos veces la corrección de calidad.' },
    { campo: 'diaasMedio', etiqueta: 'DIAAS medio de la dieta declarada', tipo: 'decimal', origen: 'calculado',
      nota: 'Distingue una dieta vegetal basada en soja y legumbres de una basada en cereales y gluten.' },
    { campo: 'proteinaObjetivo', etiqueta: 'Objetivo de proteína aplicado', tipo: 'decimal', unidad: 'g/kg/día', origen: 'calculado' },
    { campo: 'leucinaMejorComidaG', etiqueta: 'Leucina de la comida con más proteína', tipo: 'decimal', unidad: 'g', origen: 'calculado' },
    { campo: 'alertaLeucina', etiqueta: 'No alcanza el umbral de leucina por comida', tipo: 'logico', origen: 'calculado',
      codificacion: '0 = no aplica o lo alcanza | 1 = ≥65 años y ninguna comida llega a 2.5 g',
      nota: 'PROT-AGE 2013 y ESPEN 2014. Es un hallazgo distinto de "come poca proteína".' },

    // --- Suplementos de entrenamiento ---
    { campo: 'usaCreatina', etiqueta: 'Uso de creatina', tipo: 'logico', origen: 'capturado', codificacion: '0 = no | 1 = sí',
      nota: 'Eleva la creatinina sérica sin daño renal (subestima la filtración estimada) y la creatinina urinaria (infraestima la razón calcio/creatinina).' },
    { campo: 'creatinaGramosDia', etiqueta: 'Dosis de creatina', tipo: 'decimal', unidad: 'g/día', origen: 'capturado' },
    { campo: 'creatinaSupGenerico', etiqueta: 'Dosis de creatina tomada de valor genérico', tipo: 'logico', origen: 'capturado',
      codificacion: '0 = verificada con etiqueta | 1 = valor genérico' },
    { campo: 'usaProteinaPolvoEntrenamiento', etiqueta: 'Uso de proteína en polvo', tipo: 'logico', origen: 'capturado', codificacion: '0 = no | 1 = sí' },
    { campo: 'proteinaPolvoEntrenamientoTipo', etiqueta: 'Tipo de proteína en polvo', tipo: 'categorico', origen: 'capturado',
      codificacion: 'whey_hidrolizada | whey_aislada | whey_concentrada | caseina | huevo | carne | soja | chicharo | mezcla_vegetal' },
    { campo: 'proteinaPolvoEntrenamientoDiasSemana', etiqueta: 'Días de consumo de proteína en polvo', tipo: 'entero', unidad: 'días/semana', origen: 'capturado' },
    { campo: 'proteinaPolvoEntrenamientoVecesDia', etiqueta: 'Tomas de proteína en polvo', tipo: 'entero', unidad: 'veces/día', origen: 'capturado' },
    { campo: 'proteinaPolvoEntrenamientoGramosPorcion', etiqueta: 'Proteína por porción del polvo', tipo: 'decimal', unidad: 'g', origen: 'capturado' },
    { campo: 'proteinaPolvoEntrenamientoSupGenerico', etiqueta: 'Proteína en polvo tomada de valor genérico', tipo: 'logico', origen: 'capturado',
      codificacion: '0 = verificada con etiqueta | 1 = valor genérico' },

    // --- Calidad del cuestionario ---
    { campo: 'alimentosConsumidosTotal', etiqueta: 'Alimentos declarados con consumo mayor que cero', tipo: 'entero', origen: 'calculado' },
    { campo: 'alimentosVerificadosConEtiqueta', etiqueta: 'Alimentos cuyo dato se verificó con etiqueta', tipo: 'entero', origen: 'calculado' },
    { campo: 'plausibilidadBanderas', etiqueta: 'Banderas de plausibilidad del cuestionario', tipo: 'texto', origen: 'calculado',
      codificacion: 'cuestionario_incompleto | subregistro_probable | sobredeclaracion_probable (separadas por |)',
      nota: 'Nuevo en la v6.0. NO descarta al participante: lo marca. La decisión de excluir es del investigador y debe documentarse.' },

    // --- Laboratorio ---
    { campo: 'labCalcioSerico', etiqueta: 'Calcio sérico total', tipo: 'decimal', unidad: 'mg/dL', rangoValido: '5-15', origen: 'capturado' },
    { campo: 'labAlbumina', etiqueta: 'Albúmina sérica', tipo: 'decimal', unidad: 'g/dL', rangoValido: '1.5-6', origen: 'capturado',
      nota: 'Nuevo en la v6.0. Sin ella el calcio total no se puede corregir y la hipoalbuminemia produce falsos positivos de hipocalcemia.' },
    { campo: 'labCalcioCorregido', etiqueta: 'Calcio corregido por albúmina (Payne)', tipo: 'decimal', unidad: 'mg/dL', origen: 'calculado',
      nota: 'Ca + 0.8 × (4.0 − albúmina). Aproximación de regresión; el patrón es el calcio iónico.' },
    { campo: 'lab25OHVitD', etiqueta: '25-hidroxivitamina D sérica', tipo: 'decimal', unidad: 'ng/mL', rangoValido: '0-150', origen: 'capturado' },
    { campo: 'labPTH', etiqueta: 'Paratohormona intacta', tipo: 'decimal', unidad: 'pg/mL', rangoValido: '1-2000', origen: 'capturado',
      nota: 'Nuevo en la v6.0. Su ascenso precede a cualquier cambio del calcio sérico: es el dato más informativo del panel óseo.' },
    { campo: 'labFosforo', etiqueta: 'Fósforo sérico', tipo: 'decimal', unidad: 'mg/dL', rangoValido: '0.5-10', origen: 'capturado' },
    { campo: 'labFosfatasaAlcalina', etiqueta: 'Fosfatasa alcalina total', tipo: 'decimal', unidad: 'U/L', rangoValido: '10-1000', origen: 'capturado',
      nota: 'Marcador de recambio óseo solo si se ha descartado colestasis.' },
    { campo: 'labMagnesio', etiqueta: 'Magnesio sérico', tipo: 'decimal', unidad: 'mg/dL', rangoValido: '0.5-5', origen: 'capturado',
      nota: 'Cofactor obligado de la 1α-hidroxilación renal y de la secreción de PTH.' },
    { campo: 'labCreatinina', etiqueta: 'Creatinina sérica', tipo: 'decimal', unidad: 'mg/dL', rangoValido: '0.2-15', origen: 'capturado' },
    { campo: 'labTFGe', etiqueta: 'Tasa de filtración glomerular estimada', tipo: 'decimal', unidad: 'mL/min/1.73 m²', origen: 'calculado',
      nota: 'CKD-EPI 2021 sin término racial (Inker et al. 2021). Subestimada en usuarios de creatina.' },
    { campo: 'labEstadioKDIGO', etiqueta: 'Estadio KDIGO de función renal', tipo: 'categorico', origen: 'calculado',
      codificacion: 'G1 | G2 | G3a | G3b | G4 | G5' },
    { campo: 'labCalcio24h', etiqueta: 'Calcio urinario de 24 horas', tipo: 'decimal', unidad: 'mg/24h', origen: 'capturado' },
    { campo: 'labCalcioOrina', etiqueta: 'Calcio en muestra aislada de orina', tipo: 'decimal', unidad: 'mg/dL', origen: 'capturado' },
    { campo: 'labCreatininaOrina', etiqueta: 'Creatinina en muestra aislada de orina', tipo: 'decimal', unidad: 'mg/dL', origen: 'capturado' },
    { campo: 'labRazonCaCr', etiqueta: 'Razón calcio/creatinina urinaria', tipo: 'decimal', unidad: 'mg/mg', origen: 'calculado',
      nota: 'Nuevo en la v6.0. La v2.7 ya registraba el uso de creatina justificándolo por su efecto sobre esta razón, pero la razón no se calculaba.' },
    { campo: 'labHipercalciuria', etiqueta: 'Hipercalciuria por cualquier criterio', tipo: 'logico', origen: 'calculado',
      codificacion: '0 = no | 1 = sí' },
    { campo: 'panelPatrones', etiqueta: 'Patrones bioquímicos detectados', tipo: 'texto', origen: 'calculado',
      codificacion: 'identificadores separados por |',
      nota: 'Nuevo en la v6.0. El valor de un panel está en el patrón, no en hallazgos aislados.' },
    { campo: 'panelNivelDerivacion', etiqueta: 'Nivel de derivación sugerido por el panel', tipo: 'categorico', origen: 'calculado',
      codificacion: 'sin_hallazgos | seguimiento | derivacion | derivacion_urgente',
      nota: 'Sugerencia de cribado. La interpretación clínica corresponde al médico tratante.' },

    // --- Índices de cribado óseo ---
    { campo: 'ostIndice', etiqueta: 'Índice OST', tipo: 'entero', origen: 'calculado',
      nota: '0.2 × (peso − edad), truncado. Koh et al. 2001. Desempeño mejor en mujeres posmenopáusicas.' },
    { campo: 'ostCategoria', etiqueta: 'Categoría del OST', tipo: 'categorico', origen: 'calculado',
      codificacion: 'bajo | intermedio | alto' },
    { campo: 'oraiPuntaje', etiqueta: 'Puntaje ORAI', tipo: 'entero', rangoValido: '0-26', origen: 'calculado',
      nota: 'Cadarette et al. 2000. Solo aplicable a mujeres de 45 años o más; vacío en el resto.' },
    { campo: 'oraiSuperaCorte', etiqueta: 'ORAI por encima del corte de 9', tipo: 'logico', origen: 'calculado',
      codificacion: '0 = no | 1 = sí | vacío = no aplicable' },
    { campo: 'riesgoOseoPuntaje', etiqueta: 'Puntaje compuesto de riesgo óseo', tipo: 'entero', origen: 'calculado',
      nota: 'Construcción propia, grado HEURÍSTICO. Es el predictor que el estudio debe calibrar contra densitometría.' },
    { campo: 'riesgoOseoMaximo', etiqueta: 'Puntaje máximo alcanzable de riesgo óseo', tipo: 'entero', origen: 'calculado',
      nota: 'Depende de cuántos analitos se declararon: el puntaje bruto no es comparable entre participantes con y sin laboratorio.' },
    { campo: 'riesgoOseoFraccion', etiqueta: 'Fracción del máximo alcanzable', tipo: 'decimal', unidad: '%', origen: 'calculado',
      nota: 'Es la magnitud sobre la que se decide la categoría, precisamente para que tener más datos no empuje por sí solo a una categoría peor.' },
    { campo: 'riesgoOseoCategoria', etiqueta: 'Categoría de riesgo óseo', tipo: 'categorico', origen: 'calculado',
      codificacion: 'bajo | moderado | alto' },

    // --- Distribución de las fuentes y recomendaciones ---
    { campo: 'distribucionDiasQueAlcanzan', etiqueta: 'Días por semana en que el patrón declarado alcanzaría la meta de calcio absorbido', tipo: 'entero', unidad: 'días/semana', rangoValido: '0-7', origen: 'calculado',
      nota: 'NO es un registro de los días del participante: la semana virtual es una reconstrucción que reparte las frecuencias declaradas. El nombre del campo lo dice a propósito.' },
    { campo: 'distribucionVeredicto', etiqueta: 'Veredicto de la distribución', tipo: 'categorico', origen: 'calculado',
      codificacion: { adecuada: 'Distribución adecuada', ajustable: 'Distribución ajustable', concentrada: 'Distribución concentrada' } },
    { campo: 'distribucionConcentracionPct', etiqueta: 'Fracción del calcio absorbido semanal que cae en la comida de mayor aporte', tipo: 'decimal', unidad: '%', origen: 'calculado',
      nota: 'Por la curva de saturación, concentrar el calcio en pocas comidas cuesta absorción. Es la métrica sobre la que se educa al participante.' },
    { campo: 'recomiendaDensitometria', etiqueta: 'La herramienta recomienda densitometría', tipo: 'logico', origen: 'calculado',
      codificacion: { '1': 'Sí', '0': 'No' },
      nota: 'Criterios de edad y sexo de guía publicada más riesgo calculado. El patrón dietético NO es criterio: en EPIC-Oxford el exceso de riesgo en veganos se atenuaba con ingesta adecuada de calcio y proteína.' },
    { campo: 'recomienda25OHD', etiqueta: 'La herramienta recomienda 25-hidroxivitamina D sérica', tipo: 'logico', origen: 'calculado',
      codificacion: { '1': 'Sí', '0': 'No' } },
    { campo: 'derivacionProfesional', etiqueta: 'Profesional al que se deriva', tipo: 'categorico', origen: 'calculado',
      codificacion: { nutricionista_plantas: 'Nutricionista con formación en nutrición basada en plantas',
                      nutricionista_general: 'Nutricionista o médico', '': 'No se deriva' } },
    { campo: 'fracturaPreviaFragilidad', etiqueta: 'Antecedente de fractura por fragilidad', tipo: 'logico', origen: 'capturado',
      codificacion: { '1': 'Sí', '0': 'No' },
      nota: 'Es el predictor más fuerte de una nueva fractura y criterio de densitometría a cualquier edad.' },

    // --- Conclusión y conducta sugerida ---
    // Son la salida que responde al propósito del instrumento, así que se
    // exportan: permiten contar cuántos participantes se derivaron y por
    // qué, y contrastar esa decisión contra el patrón de oro.
    { campo: 'conductaVeredicto', etiqueta: 'Veredicto global de la conducta sugerida', tipo: 'categorico', origen: 'calculado',
      codificacion: { cubre_ambos: 'Cubre calcio y vitamina D', ajuste_dietetico: 'Al límite, revisar patrón',
                      derivar_evaluar_suplementacion: 'Derivar para evaluar suplementación',
                      derivar_prioritario: 'Hallazgo bioquímico, evaluación médica previa',
                      datos_incompletos: 'Datos insuficientes' } },
    { campo: 'conductaCalcioEstado', etiqueta: 'Estado de adecuación de calcio', tipo: 'categorico', origen: 'calculado',
      codificacion: { cubre: 'Cubre el requerimiento', limite: 'Al límite', no_cubre: 'No cubre', sin_datos: 'Sin datos' } },
    { campo: 'conductaCalcioVia', etiqueta: 'Conducta sugerida para calcio', tipo: 'categorico', origen: 'calculado',
      nota: 'La suplementación de calcio es la segunda opción tras el ajuste dietético, porque en dietas basadas en plantas la meta es alcanzable con alimentos y suplementar tiene riesgos propios.' },
    { campo: 'conductaVitDEstado', etiqueta: 'Estado de adecuación de vitamina D', tipo: 'categorico', origen: 'calculado',
      codificacion: { cubre: 'Cubre el requerimiento', limite: 'Al límite', no_cubre: 'No cubre',
                      indeterminado: 'No resoluble con la estimación', exceso: 'Por encima del rango', sin_datos: 'Sin datos' } },
    { campo: 'conductaVitDVia', etiqueta: 'Conducta sugerida para vitamina D', tipo: 'categorico', origen: 'calculado' },
    { campo: 'conductaVitDBase', etiqueta: 'Base de la conclusión de vitamina D', tipo: 'categorico', origen: 'calculado',
      codificacion: { biomarcador: '25-hidroxivitamina D sérica', estimacion: 'Estimación del cuestionario' },
      nota: 'Cuando hay valor sérico declarado, tiene precedencia sobre la estimación del cuestionario.' },
    { campo: 'conductaRequiereDerivacion', etiqueta: 'Requiere derivación a nutricionista o médico', tipo: 'logico', origen: 'calculado',
      codificacion: { '1': 'Sí', '0': 'No' } },

    { campo: 'notas', etiqueta: 'Notas del evaluador', tipo: 'texto', origen: 'capturado',
      nota: 'Los puntos y coma y los saltos de línea se sustituyen por espacios para no romper el CSV.' }
];


// ------------------------------------------------------------
// COLUMNAS DEL PATRÓN DE ORO
// ------------------------------------------------------------
// Se exportan VACÍAS a propósito. El CSV que sale de la herramienta ya
// tiene la forma que el análisis de validación necesita: el
// investigador pega los valores de densitometría y de laboratorio de
// referencia en estas columnas y vuelve a importar el archivo en la
// pestaña de Validación. Sin ellas, cada análisis obliga a cruzar dos
// archivos a mano, que es donde se cometen los errores de emparejado.
const CAMPOS_PATRON_ORO = [
    { campo: 'dxaTScoreLumbar', etiqueta: 'T-score de columna lumbar (DXA)', tipo: 'decimal', origen: 'patron_oro',
      nota: 'Se rellena desde el informe de densitometría. Valores más BAJOS indican más riesgo: en la pestaña de Validación hay que marcar el sentido inverso del predictor.' },
    { campo: 'dxaTScoreFemurTotal', etiqueta: 'T-score de fémur total (DXA)', tipo: 'decimal', origen: 'patron_oro' },
    { campo: 'dxaTScoreCuelloFemoral', etiqueta: 'T-score de cuello femoral (DXA)', tipo: 'decimal', origen: 'patron_oro' },
    { campo: 'dxaDiagnostico', etiqueta: 'Diagnóstico por densitometría (OMS)', tipo: 'categorico', origen: 'patron_oro',
      codificacion: 'normal | osteopenia | osteoporosis',
      nota: 'Criterio de la OMS sobre el T-score más bajo de los sitios medidos: normal ≥ −1.0; osteopenia entre −1.0 y −2.5; osteoporosis ≤ −2.5.' },
    { campo: 'dxaDmoBaja', etiqueta: 'Densidad mineral ósea baja (desenlace binario)', tipo: 'logico', origen: 'patron_oro',
      codificacion: '0 = T-score > −1.0 | 1 = T-score ≤ −1.0',
      nota: 'Desenlace principal para la curva ROC del puntaje compuesto.' },
    { campo: 'dxaOsteoporosis', etiqueta: 'Osteoporosis (desenlace binario)', tipo: 'logico', origen: 'patron_oro',
      codificacion: '0 = T-score > −2.5 | 1 = T-score ≤ −2.5' },
    { campo: 'sarcopeniaEWGSOP2', etiqueta: 'Sarcopenia confirmada (EWGSOP2)', tipo: 'logico', origen: 'patron_oro',
      codificacion: '0 = no | 1 = sí',
      nota: 'Requiere fuerza de prensión y masa muscular apendicular. Cruz-Jentoft et al., Age Ageing 2019;48:16.' },
    { campo: 'fuerzaPrensionKg', etiqueta: 'Fuerza de prensión manual', tipo: 'decimal', unidad: 'kg', origen: 'patron_oro' },
    { campo: 'masaMuscularApendicularKgM2', etiqueta: 'Índice de masa muscular apendicular', tipo: 'decimal', unidad: 'kg/m²', origen: 'patron_oro' },
    { campo: 'velocidadMarchaMs', etiqueta: 'Velocidad de la marcha', tipo: 'decimal', unidad: 'm/s', origen: 'patron_oro' },
    { campo: 'retestFecha', etiqueta: 'Fecha de la segunda administración', tipo: 'fecha', origen: 'patron_oro',
      nota: 'Para el análisis test-retest. El intervalo recomendado es de 7 a 14 días: suficiente para que no se recuerden las respuestas y demasiado corto para que cambie la dieta.' },
    { campo: 'retestRiesgoOseoPuntaje', etiqueta: 'Puntaje de riesgo óseo en la segunda administración', tipo: 'entero', origen: 'patron_oro',
      nota: 'Se compara con el de la primera mediante el coeficiente de correlación intraclase.' }
];

const DICCIONARIO_COMPLETO = [...DICCIONARIO_DATOS, ...CAMPOS_PATRON_ORO];


// ------------------------------------------------------------
// GENERADORES
// ------------------------------------------------------------
const escaparCSV = (v) => {
    const s = (v === null || v === undefined) ? '' : String(v);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Diccionario en CSV plano, para adjuntar como material suplementario.
// Separador de punto y coma, que es el que espera Excel en configuración
// regional de español.
const generarCodebookCSV = (incluirPatronOro = true) => {
    const filas = incluirPatronOro ? DICCIONARIO_COMPLETO : DICCIONARIO_DATOS;
    const cabecera = ['campo', 'etiqueta', 'tipo', 'unidad', 'rango_valido', 'codificacion', 'origen', 'nota'];
    const cuerpo = filas.map(f => [
        f.campo, f.etiqueta, f.tipo, f.unidad || '', f.rangoValido || '',
        f.codificacion || '', f.origen, f.nota || ''
    ].map(escaparCSV).join(';'));
    return [cabecera.join(';'), ...cuerpo].join('\r\n');
};

// Diccionario en el formato de importación de REDCap. El orden y los
// nombres de las columnas son los que REDCap espera; los campos que no
// aplican van vacíos.
const generarREDCapDiccionarioCSV = () => {
    const tipoREDCap = (f) => {
        if (f.tipo === 'categorico' || f.tipo === 'logico') return 'radio';
        if (f.tipo === 'texto' && (f.nota || '').length > 80) return 'notes';
        return 'text';
    };
    const validacion = (f) => {
        if (f.tipo === 'entero') return 'integer';
        if (f.tipo === 'decimal') return 'number';
        if (f.tipo === 'fecha') return 'date_ymd';
        return '';
    };
    // REDCap codifica las opciones como "1, etiqueta | 2, etiqueta"
    const opciones = (f) => {
        if (f.tipo === 'logico') return '0, No | 1, Si';
        if (f.tipo !== 'categorico' || !f.codificacion) return '';
        return f.codificacion.split('|')
            .map(o => o.trim())
            .filter(Boolean)
            .map(o => {
                const clave = o.split(/[\s(]/)[0];
                return `${clave}, ${o}`;
            })
            .join(' | ');
    };
    const rango = (f) => {
        if (!f.rangoValido) return ['', ''];
        const m = /^(-?[\d.]+)\s*(?:-|a)\s*(-?[\d.]+)$/.exec(f.rangoValido.trim());
        return m ? [m[1], m[2]] : ['', ''];
    };

    const cabecera = [
        'Variable / Field Name', 'Form Name', 'Section Header', 'Field Type',
        'Field Label', 'Choices, Calculations, OR Slider Labels', 'Field Note',
        'Text Validation Type OR Show Slider Number', 'Text Validation Min',
        'Text Validation Max', 'Identifier?', 'Branching Logic (Show field only if...)',
        'Required Field?', 'Custom Alignment', 'Question Number (surveys only)',
        'Matrix Group Name', 'Matrix Ranking?', 'Field Annotation'
    ];

    const formulario = (f) => f.origen === 'patron_oro' ? 'patron_oro' : 'cald_risk_screen';

    const cuerpo = DICCIONARIO_COMPLETO.map(f => {
        const [minimo, maximo] = rango(f);
        const nota = [f.unidad ? `Unidad: ${f.unidad}` : '', f.nota || ''].filter(Boolean).join(' — ');
        return [
            f.campo.toLowerCase(), formulario(f), '', tipoREDCap(f),
            f.etiqueta, opciones(f), nota, validacion(f), minimo, maximo,
            '', '', '', '', '', '', '', `origen=${f.origen}`
        ].map(escaparCSV).join(';');
    });

    return [cabecera.join(';'), ...cuerpo].join('\r\n');
};

// Conversión a formato largo (una fila por participante y variable).
// Es el formato que necesitan los modelos mixtos y el que evita tener
// que renombrar columnas cuando se añaden variables: al crecer el
// diccionario, el archivo ancho cambia de forma y el largo no.
const convertirAFormatoLargo = (filas) => {
    const cabecera = ['codigo', 'fecha', 'motorVersion', 'motorHuella', 'variable', 'valor', 'unidad', 'origen'];
    const indice = {};
    DICCIONARIO_COMPLETO.forEach(f => { indice[f.campo] = f; });

    const salida = [cabecera.join(';')];
    (filas || []).forEach(fila => {
        Object.keys(fila).forEach(campo => {
            if (['codigo', 'fecha', 'motorVersion', 'motorHuella'].indexOf(campo) >= 0) return;
            const def = indice[campo] || {};
            salida.push([
                fila.codigo, fila.fecha, fila.motorVersion || '', fila.motorHuella || '',
                campo, fila[campo], def.unidad || '', def.origen || 'desconocido'
            ].map(escaparCSV).join(';'));
        });
    });
    return salida.join('\r\n');
};

// Campos del diccionario que NO aparecen en una fila exportada, y campos
// de la fila que NO están en el diccionario. Es la comprobación que
// mantiene el diccionario sincronizado con el código: sin ella, el
// diccionario se queda obsoleto en la primera versión que añada un campo.
const auditarCoberturaDiccionario = (filaEjemplo) => {
    const enDiccionario = new Set(DICCIONARIO_COMPLETO.map(f => f.campo));
    const enFila = new Set(Object.keys(filaEjemplo || {}));
    return {
        sinDocumentar: [...enFila].filter(c => !enDiccionario.has(c)),
        documentadosNoExportados: [...enDiccionario].filter(c => !enFila.has(c)),
        totalDiccionario: enDiccionario.size,
        totalFila: enFila.size
    };
};


// ------------------------------------------------------------
// LECTURA DE CSV
// ------------------------------------------------------------
// La pestaña de Validación tiene que poder leer el archivo que el propio
// investigador editó en Excel para añadir las columnas del patrón de oro.
// Eso implica aceptar lo que Excel produce según la configuración
// regional: punto y coma o coma como separador, comillas dobles
// escapadas duplicándolas, y el retorno de carro de Windows.
//
// El separador se detecta contando ocurrencias en la primera línea
// FUERA de comillas, que es más fiable que preguntarle al usuario.
const detectarSeparador = (primeraLinea) => {
    const contar = (sep) => {
        let n = 0, dentro = false;
        for (let i = 0; i < primeraLinea.length; i++) {
            const c = primeraLinea[i];
            if (c === '"') dentro = !dentro;
            else if (c === sep && !dentro) n++;
        }
        return n;
    };
    const puntoYComa = contar(';'), coma = contar(','), tab = contar('\t');
    if (tab >= puntoYComa && tab >= coma && tab > 0) return '\t';
    return coma > puntoYComa ? ',' : ';';
};

const parsearCSV = (texto) => {
    const limpio = String(texto || '').replace(/^\uFEFF/, '');  // marca de orden de bytes de Excel
    if (!limpio.trim()) return { valido: false, motivoKey: 'csv_empty' };

    const primeraLinea = limpio.split(/\r?\n/)[0];
    const sep = detectarSeparador(primeraLinea);

    // Recorrido carácter a carácter: un separador o un salto de línea
    // dentro de comillas es parte del valor, no un delimitador.
    const filas = [];
    let campo = '', fila = [], dentro = false;
    for (let i = 0; i < limpio.length; i++) {
        const c = limpio[i];
        if (dentro) {
            if (c === '"') {
                if (limpio[i + 1] === '"') { campo += '"'; i++; }
                else dentro = false;
            } else campo += c;
        } else if (c === '"') dentro = true;
        else if (c === sep) { fila.push(campo); campo = ''; }
        else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
        else if (c !== '\r') campo += c;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

    const noVacias = filas.filter(f => f.some(v => String(v).trim() !== ''));
    if (noVacias.length < 2) return { valido: false, motivoKey: 'csv_needs_header_and_rows', separador: sep };

    const columnas = noVacias[0].map(c => String(c).trim());
    const registros = noVacias.slice(1).map(f => {
        const o = {};
        columnas.forEach((col, j) => { o[col] = f[j] !== undefined ? String(f[j]).trim() : ''; });
        return o;
    });

    // Clasificación de columnas: una columna es numérica si TODOS sus
    // valores no vacíos se pueden convertir a número. Se usa para ofrecer
    // solo predictores utilizables y para no dejar que el usuario elija
    // una columna de texto como desenlace.
    const esNumericaCol = (col) => {
        const vals = registros.map(r => r[col]).filter(v => v !== '');
        return vals.length > 0 && vals.every(v => !isNaN(parseFloat(v)) && isFinite(v.replace(',', '.')));
    };
    // Una columna es binaria si sus únicos valores son 0 y 1: es la forma
    // que debe tener un desenlace para la curva ROC.
    const esBinariaCol = (col) => {
        const vals = [...new Set(registros.map(r => r[col]).filter(v => v !== ''))];
        return vals.length > 0 && vals.length <= 2 && vals.every(v => v === '0' || v === '1');
    };

    return {
        valido: true,
        separador: sep === '\t' ? 'tabulador' : sep,
        columnas,
        registros,
        n: registros.length,
        columnasNumericas: columnas.filter(esNumericaCol),
        columnasBinarias: columnas.filter(esBinariaCol),
        // Filas con el código repetido: normalmente indican que el
        // archivo se concatenó dos veces, y duplicar participantes
        // estrecha falsamente los intervalos de confianza.
        codigosDuplicados: (() => {
            if (columnas.indexOf('codigo') < 0) return [];
            const vistos = {}, dup = [];
            registros.forEach(r => {
                const k = r.codigo;
                if (!k) return;
                if (vistos[k]) { if (dup.indexOf(k) < 0) dup.push(k); }
                vistos[k] = true;
            });
            return dup;
        })()
    };
};

// Extrae una columna como vector numérico, aceptando la coma decimal
// que produce Excel en configuración regional de español.
const columnaNumerica = (registros, nombre) =>
    (registros || []).map(r => {
        const v = r[nombre];
        if (v === '' || v === undefined || v === null) return '';
        const n = parseFloat(String(v).replace(',', '.'));
        return isNaN(n) ? '' : n;
    });
