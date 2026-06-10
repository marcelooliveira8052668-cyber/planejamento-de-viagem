// =========================
// MAPA
// =========================

const mapa = L.map("mapa").setView(
[-23.55052, -46.633308],
6
);

L.tileLayer(
"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
{
maxZoom: 19,
attribution: "&copy; OpenStreetMap"
}
).addTo(mapa);

// =========================
// CAMPOS
// =========================

const btnCalcular =
document.getElementById("btnCalcular");

const origem =
document.getElementById("origem");

const destino =
document.getElementById("destino");

const consumo =
document.getElementById("consumo");

const gasolina =
document.getElementById("gasolina");

// =========================
// RESULTADOS
// =========================

const distancia =
document.getElementById("distancia");

const tempo =
document.getElementById("tempo");

const combustivel =
document.getElementById("combustivel");

const pedagio =
document.getElementById("pedagio");

// =========================
// BUSCAR CIDADE
// =========================

async function buscarCidade(nomeCidade){

const url =
`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(nomeCidade)}`;

const resposta =
await fetch(url);

const dados =
await resposta.json();

return dados;

}

// =========================
// BOTÃO CALCULAR
// =========================

btnCalcular.addEventListener(
"click",
async () => {

try{

const origemTexto =
origem.value.trim();

const destinoTexto =
destino.value.trim();

if(
origemTexto === "" ||
destinoTexto === ""
){

alert(
"Preencha origem e destino."
);

return;

}

const origemDados =
await buscarCidade(origemTexto);

const destinoDados =
await buscarCidade(destinoTexto);

if(
origemDados.length === 0 ||
destinoDados.length === 0
){

alert(
"Cidade não encontrada."
);

return;

}

const latOrigem =
parseFloat(origemDados[0].lat);

const lonOrigem =
parseFloat(origemDados[0].lon);

const latDestino =
parseFloat(destinoDados[0].lat);

const lonDestino =
parseFloat(destinoDados[0].lon);

// MARCADORES

L.marker([
latOrigem,
lonOrigem
]).addTo(mapa)
.bindPopup("Origem");

L.marker([
latDestino,
lonDestino
]).addTo(mapa)
.bindPopup("Destino");

// AJUSTAR MAPA

mapa.fitBounds([
[latOrigem, lonOrigem],
[latDestino, lonDestino]
]);

// VALORES TEMPORÁRIOS

const km = 100;
const horas = 1.5;

const consumoValor =
Number(consumo.value);

const gasolinaValor =
Number(gasolina.value);

if(
consumoValor > 0 &&
gasolinaValor > 0
){

const litros =
km / consumoValor;

const custo =
litros * gasolinaValor;

combustivel.textContent =
"R$ " +
custo.toFixed(2);

}

// RESULTADOS

distancia.textContent =
km + " km";

tempo.textContent =
horas + " horas";

pedagio.textContent =
"R$ 15,00";

}
catch(erro){

console.error(erro);

alert(
"Erro ao calcular viagem."
);

}

}
);