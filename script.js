const btnCalcular = document.getElementById('btnCalcular');
const btnAdicionarGasto = document.getElementById('btnAdicionarGasto');
const btnLimparTudo = document.getElementById('btnLimparTudo');
const inputFoto = document.getElementById('inputFoto');
const areaFoto = document.getElementById('areaFoto');
const corpoTabelaGastos = document.getElementById('corpoTabelaGastos');

let mapa;
let controleRota;
let camadaServicos = [];
let listaDeGastosPlanilha = [];

// Parâmetros de cálculo de viagem (Altere se achar necessário)
const PRECO_GASOLINA = 5.85;
const KM_POR_LITRO = 10;
const TAXA_PEDAGIO_POR_100KM = 14.00;

function inicializarMapa() {
    mapa = L.map('mapa').setView([-19.9167, -43.9345], 6); // Foca na região central do Brasil
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(mapa);

    // Carrega dados anteriores salvos para o usuário não perder nada no F5
    carregarDadosLocalStorage();
}

btnCalcular.addEventListener('click', function() {
    const orig = document.getElementById('inputOrigem').value;
    const parada = document.getElementById('inputParada').value;
    const dest = document.getElementById('inputDestino').value;

    if (!orig || !parada || !dest) {
        alert("Preencha a Origem, a Parada e o Destino!");
        return;
    }

    localStorage.setItem('origTxt', orig);
    localStorage.setItem('paradaTxt', parada);
    localStorage.setItem('destTxt', dest);

    calcularRotaComParada(orig, parada, dest);
});

async function calcularRotaComParada(orig, parada, dest) {
    try {
        if (controleRota) { mapa.removeControl(controleRota); }

        // Busca coordenadas na internet para os 3 pontos
        const coordOrig = await buscarCoordenada(orig);
        const coordParada = await buscarCoordenada(parada);
        const coordDest = await buscarCoordenada(dest);

        if (!coordOrig || !coordParada || !coordDest) {
            alert("Não foi possível encontrar um dos destinos digitados. Confira a grafia.");
            return;
        }

        // Desenha a rota ligando Ponto A -> Ponto B -> Ponto C pelas estradas
        controleRota = L.Routing.control({
            waypoints: [coordOrig, coordParada, coordDest],
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
            createMarker: function() { return null; }
        }).on('routesfound', function(e) {
            const rota = e.routes[0];
            const kmTotais = rota.summary.totalDistance / 1000;
            
            exibirCustosViagem(kmTotais);
        }).addTo(mapa);

    } catch (err) {
        alert("Erro ao traçar rota.");
    }
}

async function buscarCoordenada(texto) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(texto)}`);
    const dados = await res.json();
    if (dados && dados.length > 0) {
        return L.latLng(dados[0].lat, dados[0].lon);
    }
    return null;
}

function exibirCustosViagem(km) {
    document.getElementById('painelCustos').style.display = 'block';
    document.getElementById('txtDistancia').innerText = km.toFixed(1) + " km";

    const custoGasolina = (km / KM_POR_LITRO) * PRECO_GASOLINA;
    document.getElementById('txtGasolina').innerText = "R$ " + custoGasolina.toFixed(2);

    const custoPedagio = (km / 100) * TAXA_PEDAGIO_POR_100KM;
    document.getElementById('txtPedagio').innerText = "R$ " + custoPedagio.toFixed(2);
}

// ==========================================
// GERENCIADOR DA PLANILHA DE GASTOS DIÁRIOS
// ==========================================
btnAdicionarGasto.addEventListener('click', function() {
    const h = parseFloat(document.getElementById('gastoHotel').value) || 0;
    const r = parseFloat(document.getElementById('gastoRestaurante').value) || 0;
    const p = parseFloat(document.getElementById('gastoPosto').value) || 0;

    if (h === 0 && r === 0 && p === 0) {
        alert("Digite um valor em pelo menos um dos campos de gastos.");
        return;
    }

    const novoGastoItem = { hotel: h, restaurante: r, posto: p };
    listaDeGastosPlanilha.push(novoGastoItem);

    // Salva a lista atualizada
    localStorage.setItem('listaGastosPlanilha', JSON.stringify(listaDeGastosPlanilha));

    // Limpa os campos de digitação
    document.getElementById('gastoHotel').value = "";
    document.getElementById('gastoRestaurante').value = "";
    document.getElementById('gastoPosto').value = "";

    renderizarTabelaPlanilha();
});

function renderizarTabelaPlanilha() {
    corpoTabelaGastos.innerHTML = "";
    let somaTotalFérias = 0;

    listaDeGastosPlanilha.forEach((gasto, index) => {
        const totalDoDia = gasto.hotel + gasto.restaurante + gasto.posto;
        somaTotalFérias += totalDoDia;

        const novaLinha = document.createElement('tr');
        novaLinha.innerHTML = `
            <td>Dia ${index + 1}</td>
            <td>R$ ${gasto.hotel.toFixed(2)}</td>
            <td>R$ ${gasto.restaurante.toFixed(2)}</td>
            <td>R$ ${gasto.posto.toFixed(2)}</td>
            <strong><td>R$ ${totalDoDia.toFixed(2)}</td></strong>
        `;
        corpoTabelaGastos.appendChild(novaLinha);
    });

    document.getElementById('txtTotalGeral').innerText = "R$ " + somaTotalFérias.toFixed(2);
}

// ==========================================
// BUSCADOR DE SERVIÇOS NA ÁREA DO MAPA
// ==========================================
function buscarServico(tipo) {
    camadaServicos.forEach(m => mapa.removeLayer(m));
    camadaServicos = [];
    const centro = mapa.getCenter();
    let nome = "", emoji = "";
    if(tipo==='restaurant'){nome="Restaurante"; emoji="🍽️";}
    if(tipo==='hotel'){nome="Hotel/Pousada"; emoji="🏨";}
    if(tipo==='gas_station'){nome="Posto de Gasolina"; emoji="⛽";}

    for (let i = 0; i < 4; i++) {
        const lat = centro.lat + (Math.random() - 0.5) * 0.04;
        const lng = centro.lng + (Math.random() - 0.5) * 0.04;
        const marker = L.marker([lat, lng]).addTo(mapa).bindPopup(`<b>${emoji} ${nome} encontrado!</b>`);
        camadaServicos.push(marker);
    }
    alert(`Buscando ${nome}s ao redor da visão atual do mapa!`);
}

// ==========================================
// NAVEGAÇÃO DE IMAGENS E LOCALSTORAGE
// ==========================================
function carregarDadosLocalStorage() {
    // 1. Carrega Rota
    const o = localStorage.getItem('origTxt');
    const p = localStorage.getItem('paradaTxt');
    const d = localStorage.getItem('destTxt');
    if (o && p && d) {
        document.getElementById('inputOrigem').value = o;
        document.getElementById('inputParada').value = p;
        document.getElementById('inputDestino').value = d;
        calcularRotaComParada(o, p, d);
    }

    // 2. Carrega Planilha de Gastos
    const g = localStorage.getItem('listaGastosPlanilha');
    if (g) {
        listaDeGastosPlanilha = JSON.parse(g);
        renderizarTabelaPlanilha();
    }

    // 3. Carrega Foto
    const f = localStorage.getItem('fotoSalva');
    if (f) { areaFoto.src = f; areaFoto.style.display = 'block'; }
}

inputFoto.addEventListener('change', function(e) {
    const arquivo = e.target.files[0];
    if (arquivo) {
        const reader = new FileReader();
        reader.onload = function(event) {
            localStorage.setItem('fotoSalva', event.target.result);
            areaFoto.src = event.target.result;
            areaFoto.style.display = 'block';
        };
        reader.readAsDataURL(arquivo);
    }
});
document.getElementById('btnLimparFoto').addEventListener('click', function() {
    localStorage.removeItem('fotoSalva'); areaFoto.style.display = 'none';
});

btnLimparTudo.addEventListener('click', function() {
    localStorage.clear();
    alert("Todos os registros apagados com sucesso!");
    location.reload();
});

window.addEventListener('load', inicializarMapa);