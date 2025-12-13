async function loadKPI(){
  const zona = getZona();

  const subtitle = document.getElementById('kpi-subtitle');
  const cards    = document.getElementById('kpi-cards');
  const tbodyCiudad = document.querySelector('#table-ciudad tbody');
  const tbodyRuta   = document.querySelector('#table-ruta tbody');
  const updated  = document.getElementById('kpi-updated');

  // Si falta algo, no seguimos
  if (!subtitle || !cards || !tbodyCiudad || !tbodyRuta || !updated) return;

  subtitle.textContent = 'Cargando datos de la zona seleccionada...';
  cards.innerHTML = '';
  tbodyCiudad.innerHTML = '';
  tbodyRuta.innerHTML = '';
  updated.textContent = '-';

  try{
    // 1. Leer CSV
    const resp = await fetch('https://raw.githubusercontent.com/Gokzarag/RoadMap/main/MapTrack_V2.1.csv');
    const text = await resp.text();

    // 2. Separar en líneas (CORRECTO)
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length <= 1){
      subtitle.textContent = 'No se encontraron registros en el archivo.';
      return;
    }

    // 3. Pasar a filas (array de columnas)
    const rows = lines.slice(1).map(l => l.split(','));

    // Índices de columnas
    const COL_ZONA    = 1;   // Columna 2 (zona)
    const COL_VEH     = 2;   // Columna 3 (vehículo)
    const COL_CLIENTE = 3;   // Columna 4
    const COL_RUTA    = 6;   // Columna 7
    const COL_KG      = 10;  // Columna 11
    const COL_CIUDAD  = 14;  // Columna 15

    // 4. Filtrar por zona activa
    let data = rows.filter(r =>
      r.length > COL_KG &&
      (r[COL_ZONA] || '').trim() === zona
    );

    // Debug opcional en consola
    window.__dataDebug = data;

    // 5. Mapear a objeto legible
    data = data.map(r => {
      const veh    = (r[COL_VEH] || '').trim();
      const cli    = (r[COL_CLIENTE] || '').trim();
      const ruta   = (r[COL_RUTA] || '').trim();
      const ciudad = (r[COL_CIUDAD] || '').trim();
      const raw    = (r[COL_KG] || '').toString().trim().replace(',', '.');
      const kg     = parseFloat(raw) || 0;
      return {veh, cli, ruta, ciudad, kg};
    });

    // 6. Filtraciones para KPI
    const dataKg   = data.filter(d => d.veh !== 'FRT-001');
    const dataUnid = data.filter(d => d.veh !== 'BHP-765' && d.veh !== 'RES-CLI');

    const kgPlan      = dataKg.reduce((s,d)=>s + d.kg, 0);
    const clientesSet = new Set(data.map(d=>d.cli).filter(x=>x));
    const vehSet      = new Set(dataUnid.map(d=>d.veh).filter(x=>x));

    const nClientes = clientesSet.size;
    const nUnidades = vehSet.size;

    const kgVeh  = nUnidades ? kgPlan / nUnidades : 0;
    const cliVeh = nUnidades ? nClientes / nUnidades : 0;
    const kgCli  = nClientes ? kgPlan / nClientes : 0;

    // Formateadores
    function fmtKg(x){ return x.toLocaleString('es-PE',{maximumFractionDigits:0}); }
    function fmtNum(x){ return x.toLocaleString('es-PE',{maximumFractionDigits:0}); }
    function fmtDec(x){ return x.toLocaleString('es-PE',{maximumFractionDigits:1}); }

    // 7. Tarjetas KPI
    const htmlCards = [
      {titulo:'Kg Planificados',   valor:fmtKg(kgPlan)},
      {titulo:'N° Clientes',       valor:fmtNum(nClientes)},
      {titulo:'N° Unidades',       valor:fmtNum(nUnidades)},
      {titulo:'Kg/Vehículo',       valor:fmtKg(kgVeh)},
      {titulo:'Clientes/Vehículo', valor:fmtDec(cliVeh)},
      {titulo:'Kg/Cliente',        valor:fmtKg(kgCli)}
    ].map(k => `
      <div class="mod-card">
        <h2>${k.titulo}</h2>
        <p style="font-size:22px;font-weight:700;margin-top:2px;">${k.valor}</p>
      </div>
    `).join('');
    document.getElementById('kpi-cards').innerHTML = htmlCards;

    // 8. Resumen por CIUDAD (tabla)
    const mapCiudad = new Map();
    dataKg.forEach(d=>{
      const key = d.ciudad || 'Sin ciudad';
      if (!mapCiudad.has(key)) mapCiudad.set(key,{kg:0, clientes:new Set()});
      const obj = mapCiudad.get(key);
      obj.kg += d.kg;
      if (d.cli) obj.clientes.add(d.cli);
    });

    tbodyCiudad.innerHTML = '';
    Array.from(mapCiudad.entries())
      .sort((a,b)=>b[1].kg - a[1].kg)
      .forEach(([c,info])=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${c}</td>
          <td>${fmtKg(info.kg)}</td>
          <td>${info.clientes.size}</td>
        `;
        tbodyCiudad.appendChild(tr);
      });

    // 9. Resumen por RUTA (tabla)
    const mapRuta = new Map();
    dataKg.forEach(d=>{
      const key = d.ruta || 'Sin ruta';
      if (!mapRuta.has(key)) mapRuta.set(key,{kg:0, clientes:new Set()});
      const obj = mapRuta.get(key);
      obj.kg += d.kg;
      if (d.cli) obj.clientes.add(d.cli);
    });

    tbodyRuta.innerHTML = '';
    Array.from(mapRuta.entries())
      .sort((a,b)=>b[1].kg - a[1].kg)
      .forEach(([r,info])=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r}</td>
          <td>${fmtKg(info.kg)}</td>
          <td>${info.clientes.size}</td>
        `;
        tbodyRuta.appendChild(tr);
      });

    subtitle.textContent = 'Resumen calculado para la zona activa.';
    updated.textContent = 'Actualizado: ' + new Date().toLocaleString('es-PE');
  }catch(e){
    console.error(e);
    subtitle.textContent = 'Error al cargar los datos.';
  }
}