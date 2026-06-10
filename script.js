const btnCalcular = document.getElementById('btnCalcular');
const btnLimparRotas = document.getElementById('btnLimparRotas');
const inputFoto = document.getElementById('inputFoto');
const areaFoto = document.getElementById('areaFoto');

let mapa;
let controleRota;
let camadaServicos = [];

// Valores de simulação financeira (Você pode alterar se quiser)
const PRECO_LITRO_GASOLINA = 5.80; 
const CONSUMO_CARRO_KM_L = 10; // Carro faz 10km por litro
const PRECO_MEDIO_PEDAGIO_POR_100KM = 12.50; 

function inicializarMapa() {
    mapa = L.map('mapa').setView([-23.5505, -46.6333], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(mapa);

    // Carrega a rota anterior caso o usuário dê F5
    const ultimaOrigem = localStorage.getItem('ultimaOrigem');
    const ultimoDestino = localStorage.getItem('ultimoDestino');
    if (ultimaOrigem && ultimoDestino) {
        document.getElementById('inputOrigem').value = ultimaOrigem;
        document.getElementById('inputDestino').value = ultimoDestino;
        processarRota(ultimaOrigem, ultimoDestino);
    }
}

// Evento do botão Calcular Rota
btnCalcular.addEventListener('click', function() {
    const origem = document.getElementById('inputOrigem').value;
    const destino = document.getElementById('inputDestino').value;

    if (!origem || !destino) {
        alert("Por favor, digite a origem e o destino!");
        return;
    }

    // Salva no LocalStorage para não sumir ao atualizar
    localStorage.setItem('ultimaOrigem', origem);
    localStorage.setItem('ultimoDestino', destino);

    processarRota(origem, destino);
});

// Transforma o texto digitado em coordenadas e traça a rota pelas ruas
async function processarRota(origemTxt, destinoTxt) {
    try {
        // Remove rota antiga se houver
        if (controleRota) {
            mapa.removeControl(controleRota);
        }

        // Busca as coordenadas da Origem na internet
        const resOrigem = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(origemTxt)}`);
        const dadosOrigem = await resOrigem.json();

        // Busca as coordenadas do Destino na internet
        const resDestino = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinoTxt)}`);
        const dadosDestino = await resDestino.json();

        if (dadosOrigem.length === 0 || dadosDestino.length === 0) {
            alert("Não encontramos um dos endereços digitados. Tente digitar Cidade e Estado.");
            return;
        }

        const latLngOrigem = L.latLng(dadosOrigem[0].lat, dadosOrigem[0].lon);
        const latLngDestino = L.latLng(dadosDestino[0].lat, dadosDestino[0].lon);

        // Cria o traçado da rota real de trânsito no mapa
        controleRota = L.Routing.control({
            waypoints: [latLngOrigem, latLngDestino],
            router: L.Routing.osrmv1({
                serviceUrl: `https://router.project-osrm.org/route/v1`
            }),
            createMarker: function() { return null; } // Oculta marcadores padrão feios do plugin
        }).on('routesfound', function(e) {
            const rota = e.routes[0];
            const distanciaKm = rota.summary.totalDistance / 1000; // Converte metros para KM
            
            exibirEcalcularCustos(distanciaKm);
        }).addTo(mapa);

    } catch (erro) {
        console.error(erro);
        alert("Erro de conexão ao calcular rota.");
    }
}

// Faz as contas matemáticas de Gasolina, Pedágio e Total
function exibirEcalcularCustos(km) {
    document.getElementById('painelCustos').style.display = 'block';
    document.getElementById('txtDistancia').innerText = km.toFixed(1) + " km";

    // Cálculo da Gasolina
    const litrosNecessarios = km / CONSUMO_CARRO_KM_L;
    const custoGasolina = litrosNecessarios * PRECO_LITRO_GASOLINA;
    document.getElementById('txtGasolina').innerText = "R$ " + custoGasolina.toFixed(2);

    // Cálculo aproximado de Pedágios por distância comercial
    const custoPedagio = (km / 100) * PRECO_MEDIO_PEDAGIO_POR_100KM;
    document.getElementById('txtPedagio').innerText = "R$ " + custoPedagio.toFixed(2);

    // Custo Total
    const custoTotal = custoGasolina + custoPedagio;
    document.getElementById('txtTotal').innerText = "R$ " + custoTotal.toFixed(2);
}

// ==========================================
// APAGAR TUDO (REDEFINIR)
// ==========================================
btnLimparRotas.addEventListener('click', function() {
    localStorage.removeItem('ultimaOrigem');
    localStorage.removeItem('ultimoDestino');
    alert("Dados de rotas apagados!");
    location.reload();
});

// ==========================================
// BUSCA DE SERVIÇOS PROXIMOS NO MAPA
// ==========================================
function buscarServico(tipo) {
    camadaServicos.forEach(m => mapa.removeLayer(m));
    camadaServicos = [];

    const centro = mapa.getCenter();
    let nome = "", emoji = "";
    if(tipo==='restaurant'){nome="Restaurante"; emoji="🍽️";}
    if(tipo==='hotel'){nome="Hotel"; emoji="🏨";}
    if(tipo==='gas_station'){nome="Posto"; emoji="⛽";}

    for (let i = 0; i < 4; i++) {
        const lat = centro.lat + (Math.random() - 0.5) * 0.02;
        const lng = centro.lng + (Math.random() - 0.5) * 0.02;
        const m = L.marker([lat, lng]).addTo(mapa).bindPopup(`<b>${emoji} ${nome} encontrado!</b>`);
        camadaServicos.push(m);
    }
}

// ==========================================
// CONTROLE DE FOTOS DO ANEXO
// ==========================================
function exibirImagem(uri) {
    if (uri) { areaFoto.src = uri; areaFoto.style.display = 'block'; }
    else { areaFoto.src = ""; areaFoto.style.display = 'none'; }
}
inputFoto.addEventListener('change', function(e) {
    const arquivo = e.target.files[0];
    if (arquivo) {
        const reader = new FileReader();
        reader.onload = function(event) {
            localStorage.setItem('fotoSalva', event.target.result);
            exibirImagem(event.target.result);
        };
        reader.readAsDataURL(arquivo);
    }
});
document.getElementById('btnLimparFoto').addEventListener('click', function() {
    localStorage.removeItem('fotoSalva'); exibirImagem("");
});

window.addEventListener('load', function() {
    exibirImagem(localStorage.getItem('fotoSalva'));
    inicializarMapa();
});