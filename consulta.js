<!-- Última versión compilada y minificada -->
<script src="https://tecactus-4b42.kxcdn.com/reniec-sunat-js.min.js"></script>

<!-- Ejemplo -->
<script>
    var tecactusApi = new TecactusApi("tu-token-de-acceso-personal")
    
    tecactusApi.Reniec.getDni("41235678")
        .then(function (response) {
            console.log("consulta correcta!")
            console.log(response.data)
        })
        .catch(function (response) {
            console.log("algo ocurrió")
            console.log("código de error: " + response.code)
            console.log("mensaje de respuesta: " + response.status)
            console.log(response.data)
        })
</script>