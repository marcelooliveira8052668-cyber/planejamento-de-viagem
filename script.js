// ==========================================
// 1. MAPEAMENTO DOS ELEMENTOS DA INTERFACE
// ==========================================
const inputOrigem  = document.getElementById('origem');
const inputParada  = document.getElementById('parada');
const inputDestino = document.getElementById('destino');

const btnInverter = document.getElementById('btn-inverter');
const btnCalcular = document.getElementById('btn-calcular');

const resDistancia = document.getElementById('res-distancia');
const resTempo     = document.getElementById('res-tempo');
const resPedagio   = document.getElementById('res-pedagio');
const resGasolina  = document.getElementById('res-gasolina');

const fotoUpload   = document.getElementById('foto-upload');
const previewFotos = document.getElementById('preview-fotos');
const poiResults   = document.getElementById('poi-results');

// Variável global para controlar o mapa e não duplicar
let mapaLeaflet = null;
let camadaRota = null;

// Inicializa um mapa padrão focado no Brasil assim que a página carrega
function inicializarMapa() {
    const mapaContainer = document.getElementById('map');
    // Limpa o texto de placeholder antigo
    mapaContainer.innerHTML = ""; 
    
    // Cria o mapa focado nas coordenadas centrais do Brasil
    mapaLeaflet = L.map('map').setView([-14.235, -51.925], 4);

    // Adiciona o visual do OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapaLeaflet);
}

// ==========================================
// 2. FUNÇÃO AUXILIAR: BUSCAR COORDENADAS (Geocoding)
// ==========================================
// Transforma o texto digitado (Ex: "São Paulo") em Latitude e Longitude reais
async function buscarCoordenadas(cidade) {
    if (!cidade || cidade === "Nenhuma") return null;
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cidade)}&limit=1`;
    try {
        const resposta = await fetch(url);
        const dados = await resposta.json();
        if (dados && dados.length > 0) {
            return {
                lat: parseFloat(dados[0].lat),
                lon: parseFloat(dados[0].lon),
                nome: dados[0].display_name
            };
        }
        return null;
    } catch (erro) {
        console.error("Erro ao buscar coordenadas: ", erro);
        return null;
    }
}

// ==========================================
// 3. SISTEMA DE CÁLCULO DE ROTA REAL (API OSRM)
// ==========================================
btnCalcular.addEventListener('click', async () => {
    const origem = inputOrigem.value.trim();
    const parada = inputParada.value.trim();
    const destino = inputDestino.value.trim();

    if (!origem || !destino) {
        alert("Por favor, preencha pelo menos a Origem e o Destino!");
        return;
    }

    btnCalcular.innerText = "Buscando cidades...";
    btnCalcular.disabled = true;

    // 1. Transforma os textos digitados em pontos de GPS reais
    const coordOrigem = await buscarCoordenadas(origem);
    const coordParada = parada ? await buscarCoordenadas(parada) : null;
    const coordDestino = await buscarCoordenadas(destino);

    if (!coordOrigem || !coordDestino) {
        alert("Não conseguimos encontrar a Origem ou o Destino. Digite o nome da cidade e estado detalhado.");
        btnCalcular.innerText = "Calcular Rota";
        btnCalcular.disabled = false;
        return;
    }

    btnCalcular.innerText = "Traçando rota real...";

    // 2. Monta a URL da API de rotas (OSRM) dependendo se tem parada ou não
    let urlRota = `https://router.project-osrm.org/route/v1/driving/${coordOrigem.lon},${coordOrigem.lat};`;
    if (coordParada) {
        urlRota += `${coordParada.lon},${coordParada.lat};`;
    }
    urlRota += `${coordDestino.lon},${coordDestino.lat}?overview=full&geometries=geojson`;

    try {
        const resposta = await fetch(urlRota);
        const dados = await resposta.json();

        if (!dados.routes || dados.routes.length === 0) {
            alert("Não foi possível traçar uma rota terrestre entre esses pontos.");
            return;
        }

        const rotaMaisRapida = dados.routes[0];
        
        // Convertendo metros para Quilômetros e segundos para Minutos
        const distanciaKM = Math.round(rotaMaisRapida.distance / 1000);
        const tempoMinutos = Math.round(rotaMaisRapida.duration / 60);

        // Regra de negócio real para combustível
        const consumoMedioKMporLitro = 12; 
        const precoGasolinaPorLitro = 5.80; 
        const custoCombustivel = (distanciaKM / consumoMedioKMporLitro) * precoGasolinaPorLitro;
        
        // Pedágio estimado baseado na distância (média de mercado por KM de rodovia concessionada)
        const custoPedagio = (distanciaKM * 0.22); 

        // Injeta os resultados REAIS na tela
        resDistancia.innerText = `${distanciaKM} km`;
        resTempo.innerText = `${Math.floor(tempoMinutos / 60)}h ${tempoMinutos % 60}min`;
        resPedagio.innerText = `R$ ${custoPedagio.toFixed(2).replace('.', ',')}`;
        resGasolina.innerText = `R$ ${custoCombustivel.toFixed(2).replace('.', ',')}`;

        // 3. DESENHA A LINHA NO MAPA INTERATIVO
        if (camadaRota) {
            mapaLeaflet.removeLayer(camadaRota); // Limpa a linha anterior se houver
        }

        // Desenha a linha azul do trajeto usando o GeoJSON da API
        camadaRota = L.geoJSON(rotaMaisRapida.geometry, {
            style: { color: '#1a237e', weight: 5, opacity: 0.7 }
        }).addTo(mapaLeaflet);

        // Cria marcadores vermelhos nos pontos principais
        L.marker([coordOrigem.lat, coordOrigem.lon]).addTo(camadaRota).bindPopup(`<b>Origem:</b> ${origem}`);
        if (coordParada) {
            L.marker([coordParada.lat, coordParada.lon]).addTo(camadaRota).bindPopup(`<b>Parada:</b> ${parada}`);
        }
        L.marker([coordDestino.lat, coordDestino.lon]).addTo(camadaRota).bindPopup(`<b>Destino:</b> ${destino}`);

        // Dá um zoom automático no mapa para enquadrar a rota inteirinha na tela
        mapaLeaflet.fitBounds(camadaRota.getBounds());

        // Altera dinamicamente os links rápidos de GPS do celular para as coordenadas reais do destino
        gerarLinksDeNavegacao(coordDestino.lat, coordDestino.lon);
        gerarCardsPontosDeInteresse(parada || "a rota");

        // Grava essa rota calculada de verdade lá no seu Firebase!
        salvarRotaNoFirebase(origem, parada, destino, distanciaKM, custoCombustivel);

    } catch (erro) {
        console.error("Erro ao calcular rota: ", erro);
        alert("Ocorreu um erro no servidor de mapas ao calcular. Tente novamente.");
    } finally {
        btnCalcular.innerText = "Calcular Rota";
        btnCalcular.disabled = false;
    }
});

// ==========================================
// 4. OUTRAS FUNCIONALIDADES DA INTERFACE
// ==========================================

// Inverter Origem e Parada
btnInverter.addEventListener('click', () => {
    const valorTemporario = inputOrigem.value;
    inputOrigem.value = inputParada.value;
    inputParada.value = valorTemporario;
    
    inputOrigem.style.backgroundColor = '#f0fdf4';
    inputParada.style.backgroundColor = '#fff7ed';
    setTimeout(() => {
        inputOrigem.style.backgroundColor = '';
        inputParada.style.backgroundColor = '';
    }, 500);
});

// Preview Local de Fotos
fotoUpload.addEventListener('change', (evento) => {
    previewFotos.innerHTML = '';
    const arquivos = evento.target.files;
    if (arquivos.length === 0) return;

    Array.from(arquivos).forEach(arquivo => {
        if (!arquivo.type.startsWith('image/')) return;
        const leitor = new FileReader();
        leitor.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = "Foto do diário";
            previewFotos.appendChild(img);
        };
        leitor.readAsDataURL(arquivo);
    });
});

// Alternar Abas de POI
const abas = document.querySelectorAll('.tab-btn');
abas.forEach(aba => {
    aba.addEventListener('click', () => {
        abas.forEach(a => { a.classList.remove('active'); a.setAttribute('aria-selected', 'false'); });
        aba.classList.add('active');
        aba.setAttribute('aria-selected', 'true');
    });
});

// Geração dinâmica dos links externos do Waze/Google Maps com coordenadas de verdade
function gerarLinksDeNavegacao(lat, lon) {
    const poiSection = document.querySelector('.poi-section');
    
    // Remove botões de navegação antigos se existirem para não acumular
    const navAntigo = document.getElementById('nav-externo-box');
    if (navAntigo) navAntigo.remove();

    const urlWaze = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    const urlGoogle = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    const divNav = document.createElement('div');
    divNav.id = "nav-externo-box";
    divNav.style.cssText = "margin-top: 15px; padding: 12px; background: #f0fdf4; border-radius: 8px; text-align: center;";
    divNav.innerHTML = `
        <p style="font-weight: bold; color: #166534; font-size: 13px; margin-bottom: 8px;">🚀 Enviar rota real para o celular:</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <a href="${urlGoogle}" target="_blank" style="background: #4285F4; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: bold;"><i class="fa-brands fa-google"></i> Maps</a>
            <a href="${urlWaze}" target="_blank" style="background: #33ccff; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: bold;"><i class="fa-brands fa-waze"></i> Waze</a>
        </div>
    `;
    poiSection.appendChild(divNav);
}

function gerarCardsPontosDeInteresse(local) {
    poiResults.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
            <div style="padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid var(--primary-color);">
                <strong>Hotel Central</strong> - ⭐ 4.6<br><small>Hospedagem próxima a ${local}</small>
            </div>
            <div style="padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid var(--primary-color);">
                <strong>Restaurante da Rota</strong> - ⭐ 4.4<br><small>Alimentação de fácil acesso na rodovia</small>
            </div>
        </div>
    `;
}

// ==========================================
// 5. INTEGRAÇÃO COM O FIREBASE
// ==========================================
async function salvarRotaNoFirebase(origem, parada, destino, distancia, custoGasolina) {
    if (!window.db) return;
    const { collection, addDoc, serverTimestamp } = window.firestoreConvert;
    try {
        await addDoc(collection(window.db, "viagens"), {
            origem,
            parada: parada || "Nenhuma",
            destino,
            distancia,
            gastoGasolina: custoGasolina,
            dataCriacao: serverTimestamp()
        });
        carregarHistoricoFirebase();
    } catch (erro) { console.error("Erro ao salvar no Firebase: ", erro); }
}

async function carregarHistoricoFirebase() {
    if (!window.db) return;
    const { collection, getDocs, query, orderBy } = window.firestoreConvert;
    const listaRotas = document.getElementById('lista-rotas');
    try {
        const q = query(collection(window.db, "viagens"), orderBy("dataCriacao", "desc"));
        const querySnapshot = await getDocs(q);
        listaRotas.innerHTML = '';
        if (querySnapshot.empty) {
            listaRotas.innerHTML = '<li class="item-vazio">Nenhuma rota salva ainda.</li>';
            return;
        }
        querySnapshot.forEach((doc) => {
            const dados = doc.data();
            const li = document.createElement('li');
            li.style.padding = "10px"; li.style.borderBottom = "1px solid #e2e8f0"; li.style.fontSize = "14px";
            li.innerHTML = `
                <i class="fa-solid fa-route" style="color: var(--accent-color);"></i> 
                <strong>${dados.origem}</strong> ➔ <strong>${dados.destino}</strong> 
                <br><small style="color: var(--text-muted);">Parada: ${dados.parada} | Distância: ${dados.distancia}km</small>
            `;
            listaRotas.appendChild(li);
        });
    } catch (erro) { console.error("Erro ao buscar histórico: ", erro); }
}

// Inicializa o mapa e o histórico assim que a página abrir
window.addEventListener('DOMContentLoaded', () => {
    inicializarMapa();
    setTimeout(carregarHistoricoFirebase, 1500);
});