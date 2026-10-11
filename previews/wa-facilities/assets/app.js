// WA Facilities · protótipo de gestão de serviços
// Lógica do index.html. O support.js (dc-runtime) chama window.WAFacilities(DCLogic, React)
// pela ponte em <script data-dc-script> e recebe a classe Component.
window.WAFacilities = function (DCLogic, React) {
  // ===== Data simulada e nomes dos dias =====
  const TODAY = '2026-10-20',
    NOW = '10:40';
  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DOWL = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];

  // ===== Utilitários de data, hora e texto =====
  const pd = s => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const isoOf = d =>
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0');
  const addD = (s, n) => {
    const d = pd(s);
    d.setDate(d.getDate() + n);
    return isoOf(d);
  };
  const br = s => {
    const [y, m, d] = s.split('-');
    return d + '/' + m + '/' + y;
  };
  const brToIso = s => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s || '').trim());
    return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
  };
  const monOf = s => {
    const d = pd(s);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoOf(d);
  };
  const tm = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const okT = t => /^([01]\d|2[0-3]):[0-5]\d$/.test((t || '').trim());
  const p2 = n => String(n).padStart(2, '0');
  const addMin = (t, n) => {
    const m = tm(t) + n;
    return p2(Math.floor(m / 60)) + ':' + p2(m % 60);
  };
  const money = v =>
    'R$ ' +
    v
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const ini = n =>
    n
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  const first = n => n.split(' ')[0];
  const range = n => Array.from({ length: n }, (_, i) => i);

  // ===== Constantes: status, recorrência, tipos de serviço e orientações =====
  // cls: classe de cor definida em assets/app.css (seção "Tons")
  const ST = {
    agendado: { label: 'Agendado', cls: 'tone-agendado', icon: 'schedule' },
    andamento: { label: 'Em andamento', cls: 'tone-andamento', icon: 'autorenew' },
    concluido: { label: 'Concluído', cls: 'tone-concluido', icon: 'check_circle' },
    cancelado: { label: 'Cancelado', cls: 'tone-cancelado', icon: 'block' }
  };
  const REC = { nao: 'Não repete', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' };
  const TIPOS = [
    'Limpeza pós-obra residencial',
    'Limpeza pós-obra comercial',
    'Tratamento de pisos',
    'Limpeza pré-mudança',
    'Limpeza pós-mudança',
    'Limpeza de vidros e acabamentos',
    'Higienização recorrente'
  ];
  const ORI = {
    'Limpeza pós-obra residencial':
      'Remover poeira fina, respingos de tinta e resíduos de argamassa. Pisos de madeira: usar apenas pano úmido. Entulho leve em sacos, deixar na área indicada pelo zelador.',
    'Limpeza pós-obra comercial':
      'Limpeza fina de pisos, vidros, luminárias e bancadas. Priorizar fachada e área de atendimento. Chave com o encarregado da obra.',
    'Tratamento de pisos':
      'Aplicar removedor neutro e polir com enceradeira. Isolar a área com fita e sinalização. Aguardar 2 h de secagem antes de liberar a circulação.',
    'Limpeza pré-mudança':
      'Imóvel vazio. Limpar armários por dentro, box, azulejos e janelas. A portaria libera a entrada com documento.',
    'Limpeza pós-mudança':
      'Retirar papelões e plásticos das embalagens, limpar armários e eletrodomésticos por fora. Cliente estará no local.',
    'Limpeza de vidros e acabamentos':
      'Vidros internos e externos acessíveis, esquadrias e trilhos. Não usar produtos abrasivos nas películas.',
    'Higienização recorrente':
      'Rotina padrão: hall, elevadores, escadas e garagem. Registrar fotos de antes e depois. Falar com o zelador ao chegar.'
  };

  // ===== Dados de exemplo: equipe =====
  const PEOPLE0 = [
    ['walter', 'Walter Andrade', '(11) 94111-8267', 'Gestor', true],
    ['carlos', 'Carlos Henrique Souza', '(11) 97752-0314', 'Supervisor', true],
    ['renata', 'Renata Campos', '(11) 96620-4471', 'Supervisor', false],
    ['amaro', 'Amaro Silva', '(11) 98431-2207', 'Prestador', true],
    ['josefa', 'Josefa Lima', '(11) 99218-5530', 'Prestador', true],
    ['rafael', 'Rafael Souza', '(11) 98870-1146', 'Prestador', true],
    ['claudia', 'Cláudia Mendes', '(11) 97104-6682', 'Prestador', true],
    ['edson', 'Edson Pereira', '(11) 96385-9021', 'Prestador', true],
    ['luciana', 'Luciana Rocha', '(11) 99541-3378', 'Prestador', true],
    ['marcos', 'Marcos Vieira', '(11) 98012-7754', 'Prestador', true],
    ['patricia', 'Patrícia Nunes', '(11) 97633-2190', 'Prestador', true],
    ['diego', 'Diego Alves', '(11) 96927-4405', 'Prestador', true],
    ['sonia', 'Sônia Ribeiro', '(11) 99376-8812', 'Prestador', true],
    ['gilberto', 'Gilberto Moura', '(11) 98155-0637', 'Prestador', false]
  ].map(([id, nome, tel, perfil, ativo]) => ({ id, nome, tel, perfil, ativo }));

  // ===== Dados de exemplo: clientes e locais =====
  const L = (nome, end, bairro) => ({ nome, end, bairro });
  const CLIENTS0 = [
    {
      id: 'c1',
      nome: 'Construtora Valverde',
      tel: '(11) 3045-7781',
      tipo: 'Recorrente',
      obs: 'Contato: eng. Paulo Valverde. Envia as obras com uma semana de antecedência.',
      locais: [
        L('Obra Rua Gaivota', 'Rua Gaivota, 1120 – Moema, São Paulo/SP', 'Moema'),
        L('Obra Av. Santo Amaro', 'Av. Santo Amaro, 3890 – Brooklin, São Paulo/SP', 'Brooklin')
      ]
    },
    {
      id: 'c2',
      nome: 'Condomínio Edifício Ipê Roxo',
      tel: '(11) 5084-2290',
      tipo: 'Recorrente',
      obs: 'Síndica: Lúcia Ferraz. O zelador, Sr. Antônio, recebe a equipe.',
      locais: [
        L('Área comum', 'Rua Afonso Celso, 1221 – Vila Mariana, São Paulo/SP', 'Vila Mariana'),
        L('Salão de festas', 'Rua Afonso Celso, 1221 – Vila Mariana, São Paulo/SP', 'Vila Mariana')
      ]
    },
    {
      id: 'c3',
      nome: 'Barbearia Navalha Nobre',
      tel: '(11) 98820-4417',
      tipo: 'Avulso',
      obs: 'Inauguração prevista para 24/10/2026.',
      locais: [L('Loja térreo', 'Al. dos Maracatins, 780 – Moema, São Paulo/SP', 'Moema')]
    },
    {
      id: 'c4',
      nome: 'Moema Advocacia',
      tel: '(11) 3051-6620',
      tipo: 'Recorrente',
      obs: 'Vidros uma vez por mês. Acesso pela recepção do 12º andar.',
      locais: [L('Sala 1204', 'Av. Ibirapuera, 2907, sala 1204 – Moema, São Paulo/SP', 'Moema')]
    },
    {
      id: 'c5',
      nome: 'Mariana Albuquerque',
      tel: '(11) 99104-3385',
      tipo: 'Avulso',
      obs: '',
      locais: [
        L(
          'Apto 82',
          'Rua Domingos de Morais, 1450, apto 82 – Vila Mariana, São Paulo/SP',
          'Vila Mariana'
        )
      ]
    },
    {
      id: 'c6',
      nome: 'Casa & Cia Utilidades',
      tel: '(11) 5531-0098',
      tipo: 'Avulso',
      obs: 'Loja nova; obra entregue pela construtora em 20/10/2026.',
      locais: [L('Loja Brooklin', 'Rua Joaquim Nabuco, 410 – Brooklin, São Paulo/SP', 'Brooklin')]
    },
    {
      id: 'c7',
      nome: 'Clínica Odonto Sorriso',
      tel: '(11) 5049-7713',
      tipo: 'Recorrente',
      obs: 'Higienização às segundas e quartas. Não usar produtos com cheiro forte.',
      locais: [L('Unidade Moema', 'Av. Jamaris, 100, conj. 31 – Moema, São Paulo/SP', 'Moema')]
    },
    {
      id: 'c8',
      nome: 'Ricardo Hayashi',
      tel: '(11) 97741-2056',
      tipo: 'Avulso',
      obs: '',
      locais: [L('Apto 34', 'Rua Cubatão, 900, apto 34 – Paraíso, São Paulo/SP', 'Paraíso')]
    },
    {
      id: 'c9',
      nome: 'Fernanda Bonfim',
      tel: '(11) 98263-5149',
      tipo: 'Avulso',
      obs: '',
      locais: [L('Casa', 'Rua Vieira de Morais, 300 – Campo Belo, São Paulo/SP', 'Campo Belo')]
    },
    {
      id: 'c10',
      nome: 'Juliana Prado',
      tel: '(11) 99652-8870',
      tipo: 'Avulso',
      obs: '',
      locais: [L('Apto 52', 'Rua Gaivota, 455, apto 52 – Moema, São Paulo/SP', 'Moema')]
    },
    {
      id: 'c11',
      nome: 'Aline Teixeira',
      tel: '(11) 96418-2231',
      tipo: 'Avulso',
      obs: '',
      locais: [L('Apto 141', 'Rua Tutóia, 1157, apto 141 – Paraíso, São Paulo/SP', 'Paraíso')]
    }
  ];

  // ===== Dados de exemplo: serviços =====
  const CLIN =
    'Higienização de consultórios e recepção. Não usar produtos com cheiro forte; desinfetante fornecido pela clínica.';
  const mk = (id, cli, loc, tipo, data, ini, fim, prest, status, x) =>
    Object.assign(
      {
        id,
        cli,
        loc,
        tipo,
        data,
        ini,
        fim,
        prest,
        status,
        orient: cli === 'c7' ? CLIN : ORI[tipo],
        fotos: { antes: 0, depois: 0 },
        ocorr: [],
        rec: 'nao',
        motivo: ''
      },
      x || {}
    );
  const HR = 'Higienização recorrente',
    POR = 'Limpeza pós-obra residencial',
    POC = 'Limpeza pós-obra comercial',
    VID = 'Limpeza de vidros e acabamentos',
    PIS = 'Tratamento de pisos';
  const SVCS0 = [
    mk('p1', 'c2', 0, HR, '2026-10-13', '08:00', '12:00', ['josefa', 'rafael'], 'concluido', {
      rec: 'semanal',
      fotos: { antes: 2, depois: 2 }
    }),
    mk(
      'p2',
      'c1',
      1,
      POR,
      '2026-10-14',
      '08:00',
      '17:00',
      ['amaro', 'claudia', 'diego'],
      'concluido',
      { fotos: { antes: 4, depois: 4 } }
    ),
    mk('p3', 'c7', 0, HR, '2026-10-15', '09:00', '11:00', ['luciana'], 'concluido', {
      rec: 'semanal',
      fotos: { antes: 1, depois: 1 }
    }),
    mk('p4', 'c2', 0, HR, '2026-10-16', '08:00', '12:00', ['josefa', 'rafael'], 'concluido', {
      rec: 'semanal',
      fotos: { antes: 2, depois: 2 }
    }),
    mk('p5', 'c4', 0, VID, '2026-10-16', '13:00', '16:00', ['patricia'], 'concluido', {
      rec: 'mensal',
      fotos: { antes: 2, depois: 2 }
    }),
    mk('s1', 'c2', 0, HR, '2026-10-19', '08:00', '12:00', ['josefa', 'rafael'], 'concluido', {
      rec: 'semanal',
      fotos: { antes: 2, depois: 3 }
    }),
    mk(
      's2',
      'c5',
      0,
      POR,
      '2026-10-19',
      '13:00',
      '18:00',
      ['amaro', 'claudia', 'edson'],
      'concluido',
      {
        fotos: { antes: 3, depois: 3 },
        orient:
          'Apartamento recém-reformado. Remover poeira de gesso dos armários planejados e respingos de tinta nos rodapés. Piso de madeira: só pano úmido.'
      }
    ),
    mk('s3', 'c7', 0, HR, '2026-10-19', '09:00', '11:00', ['luciana'], 'concluido', {
      rec: 'semanal',
      fotos: { antes: 1, depois: 1 }
    }),
    mk('s4', 'c3', 0, POC, '2026-10-20', '08:00', '14:00', ['amaro', 'edson'], 'andamento', {
      fotos: { antes: 3, depois: 0 },
      orient:
        'Inauguração no sábado. Prioridade: lavatórios, espelhos, cadeiras e fachada de vidro. Chave com o encarregado da obra, Sr. Valter.',
      ocorr: [
        {
          autor: 'Amaro Silva',
          quando: '20/10/2026 10:12',
          tipo: 'Sujeira não prevista',
          texto:
            'Respingos de tinta no porcelanato dos lavatórios exigem removedor específico. Previsão de término ajustada para 15:00.'
        }
      ]
    }),
    mk('s5', 'c4', 0, VID, '2026-10-20', '09:00', '12:00', ['patricia'], 'andamento', {
      rec: 'mensal',
      fotos: { antes: 2, depois: 0 }
    }),
    mk('s6', 'c2', 1, PIS, '2026-10-20', '14:00', '17:00', ['josefa', 'marcos'], 'agendado'),
    mk(
      's17',
      'c10',
      0,
      'Limpeza pós-mudança',
      '2026-10-20',
      '15:00',
      '18:00',
      ['amaro'],
      'agendado',
      {
        orient:
          'Retirar papelões e plásticos, limpar armários por dentro e eletrodomésticos por fora. A cliente estará no local a partir das 15:00. Interfone 52.'
      }
    ),
    mk(
      's7',
      'c1',
      0,
      POR,
      '2026-10-21',
      '08:00',
      '17:00',
      ['amaro', 'claudia', 'diego', 'sonia'],
      'agendado'
    ),
    mk('s8', 'c8', 0, 'Limpeza pré-mudança', '2026-10-21', '09:00', '12:00', [], 'agendado'),
    mk('s9', 'c7', 0, HR, '2026-10-21', '13:30', '16:30', ['luciana'], 'agendado', {
      rec: 'semanal'
    }),
    mk('s10', 'c6', 0, POC, '2026-10-22', '08:00', '12:00', ['rafael', 'marcos'], 'agendado'),
    mk('s11', 'c4', 0, PIS, '2026-10-22', '10:00', '14:00', ['rafael'], 'agendado'),
    mk('s12', 'c9', 0, 'Limpeza pós-mudança', '2026-10-22', '14:00', '17:00', [], 'agendado'),
    mk('s13', 'c2', 0, HR, '2026-10-23', '08:00', '12:00', ['josefa', 'rafael'], 'agendado', {
      rec: 'semanal'
    }),
    mk('s14', 'c1', 0, VID, '2026-10-23', '13:00', '18:00', ['diego', 'sonia'], 'agendado'),
    mk('s15', 'c7', 0, HR, '2026-10-23', '09:00', '11:00', ['luciana'], 'cancelado', {
      rec: 'semanal',
      motivo: 'Clínica fechada para dedetização.'
    }),
    mk('s16', 'c11', 0, POR, '2026-10-24', '08:00', '13:00', [], 'agendado')
  ];

  // ===== Dados de exemplo: pagamentos e avisos =====
  const PAID0 = {};
  [
    ['p1:josefa', '17/10/2026'],
    ['p1:rafael', '17/10/2026'],
    ['p2:amaro', '17/10/2026'],
    ['p2:claudia', '17/10/2026'],
    ['p2:diego', '17/10/2026'],
    ['p3:luciana', '17/10/2026'],
    ['p4:josefa', '17/10/2026'],
    ['p5:patricia', '17/10/2026'],
    ['s1:josefa', '20/10/2026'],
    ['s3:luciana', '20/10/2026']
  ].forEach(([k, d]) => (PAID0[k] = { data: d, obs: 'PIX semanal' }));
  const AVISOS0 = [
    {
      id: 'a1',
      tipo: 'ocorrencia',
      titulo: 'Ocorrência em Barbearia Navalha Nobre',
      texto:
        'Amaro Silva: respingos de tinta exigem removedor específico. Término ajustado para 15:00.',
      quando: '20/10/2026 10:12',
      lido: false,
      sid: 's4'
    },
    {
      id: 'a2',
      tipo: 'atribuicao',
      titulo: 'Conflito de horário — Rafael Souza',
      texto: 'Atribuído a Casa & Cia (08:00–12:00) e Moema Advocacia (10:00–14:00) em 22/10/2026.',
      quando: '20/10/2026 09:02',
      lido: false,
      sid: 's11'
    },
    {
      id: 'a3',
      tipo: 'horario',
      titulo: 'Horário alterado — Clínica Odonto Sorriso',
      texto: 'Quarta, 21/10/2026: início alterado de 13:00 para 13:30 por Walter Andrade.',
      quando: '19/10/2026 16:40',
      lido: false,
      sid: 's9'
    },
    {
      id: 'a4',
      tipo: 'horario',
      titulo: 'Serviço cancelado — Clínica Odonto Sorriso',
      texto: 'Sexta, 23/10/2026, 09:00–11:00. Motivo: clínica fechada para dedetização.',
      quando: '19/10/2026 11:15',
      lido: true,
      sid: 's15'
    },
    {
      id: 'a5',
      tipo: 'atribuicao',
      titulo: 'Equipe atribuída — Construtora Valverde',
      texto: 'Amaro, Cláudia, Diego e Sônia em 21/10/2026, 08:00–17:00.',
      quando: '16/10/2026 17:05',
      lido: true,
      sid: 's7'
    },
    {
      id: 'a6',
      tipo: 'atribuicao',
      titulo: '3 serviços aguardando distribuição',
      texto: 'Ricardo Hayashi (21/10), Fernanda Bonfim (22/10) e Aline Teixeira (24/10).',
      quando: '16/10/2026 17:30',
      lido: true,
      sid: 's8'
    }
  ];
  const AVT = {
    ocorrencia: { icon: 'report', cls: 'tone-aviso-ocorrencia', label: 'Ocorrência' },
    horario: { icon: 'schedule', cls: 'tone-aviso-horario', label: 'Horário' },
    atribuicao: { icon: 'group_add', cls: 'tone-aviso-atribuicao', label: 'Atribuição' }
  };

  // ===== Regras: histórico, conflitos, formulários e validação =====
  function genHist(v, pById) {
    const nm = id => (pById[id] ? pById[id].nome : id);
    const h = [
      {
        autor: 'Walter Andrade',
        quando: br(addD(v.data, -5)) + ' 14:20',
        texto:
          v.rec !== 'nao'
            ? 'Serviço criado com repetição ' + REC[v.rec].toLowerCase()
            : 'Serviço criado'
      }
    ];
    if (v.prest.length)
      h.push({
        autor: 'Carlos Henrique Souza',
        quando: br(addD(v.data, -4)) + ' 17:05',
        texto: 'Equipe atribuída: ' + v.prest.map(nm).join(', ')
      });
    const lead = v.prest[0] ? nm(v.prest[0]) : '';
    if (v.status === 'andamento' || v.status === 'concluido') {
      h.push({
        autor: lead,
        quando: br(v.data) + ' ' + addMin(v.ini, 4),
        texto: 'Status alterado para Em andamento'
      });
      if (v.fotos.antes)
        h.push({
          autor: lead,
          quando: br(v.data) + ' ' + addMin(v.ini, 15),
          texto: v.fotos.antes + ' foto(s) de antes enviada(s)'
        });
    }
    v.ocorr.forEach(o =>
      h.push({ autor: o.autor, quando: o.quando, texto: 'Ocorrência registrada: ' + o.tipo })
    );
    if (v.status === 'concluido') {
      if (v.fotos.depois)
        h.push({
          autor: lead,
          quando: br(v.data) + ' ' + addMin(v.fim, -10),
          texto: v.fotos.depois + ' foto(s) de depois enviada(s)'
        });
      h.push({
        autor: lead,
        quando: br(v.data) + ' ' + v.fim,
        texto: 'Status alterado para Concluído'
      });
    }
    if (v.status === 'cancelado')
      h.push({
        autor: 'Walter Andrade',
        quando: br(addD(v.data, -4)) + ' 11:15',
        texto: 'Serviço cancelado. Motivo: ' + v.motivo
      });
    return h;
  }
  function conflictsOf(svcs) {
    const map = {};
    const a = svcs.filter(v => v.status !== 'cancelado');
    for (let i = 0; i < a.length; i++)
      for (let j = i + 1; j < a.length; j++) {
        const x = a[i],
          y = a[j];
        if (x.data !== y.data) continue;
        if (!(tm(x.ini) < tm(y.fim) && tm(y.ini) < tm(x.fim))) continue;
        x.prest
          .filter(p => y.prest.includes(p))
          .forEach(p => {
            (map[x.id] = map[x.id] || []).push({ pid: p, o: y });
            (map[y.id] = map[y.id] || []).push({ pid: p, o: x });
          });
      }
    return map;
  }
  function formFrom(v) {
    return {
      id: v.id,
      clienteId: v.cli,
      loc: String(v.loc),
      tipo: v.tipo,
      data: br(v.data),
      ini: v.ini,
      fim: v.fim,
      orient: v.orient,
      prest: v.prest.slice(),
      rec: v.rec,
      origRec: v.rec,
      scope: 'este'
    };
  }
  function blankForm(day) {
    return {
      id: null,
      clienteId: '',
      loc: '0',
      tipo: '',
      data: br(day),
      ini: '',
      fim: '',
      orient: '',
      prest: [],
      rec: 'nao',
      origRec: 'nao',
      scope: 'este'
    };
  }
  function blankCli() {
    return { nome: '', tel: '', tipo: 'Recorrente', obs: '', locais: [{ nome: '', end: '' }] };
  }
  function validate(f) {
    const e = {};
    if (!f.clienteId) e.cliente = 'Selecione o cliente.';
    if (!f.tipo) e.tipo = 'Selecione o tipo de serviço.';
    if (!brToIso(f.data)) e.data = 'Use o formato DD/MM/AAAA.';
    if (!okT(f.ini)) e.ini = 'Use 24 h, ex.: 08:00.';
    if (!okT(f.fim)) e.fim = 'Use 24 h, ex.: 12:00.';
    else if (okT(f.ini) && tm(f.fim) <= tm(f.ini)) e.fim = 'O término deve ser depois do início.';
    return e;
  }
  const valor = v => {
    const h = (tm(v.fim) - tm(v.ini)) / 60;
    return h <= 2 ? 100 : h <= 3 ? 130 : h <= 5 ? 170 : 260;
  };


  // ===== Componente: estado, ações e valores usados pelo template =====
  class Component extends DCLogic {
    state = this.init();
    init() {
      const p = this.props || {};
      const people = PEOPLE0.map(x => ({ ...x }));
      const pById = Object.fromEntries(people.map(x => [x.id, x]));
      const svcs = JSON.parse(JSON.stringify(SVCS0));
      svcs.forEach(v => (v.hist = genHist(v, pById)));
      const day = p.day || TODAY;
      const st = {
        role: p.role || 'gestor',
        mode: p.mode || 'proto',
        view: p.view || 'agenda',
        amode: p.agendaMode || 'semana',
        week: monOf(day),
        day,
        agState: p.agendaState || 'normal',
        fPrest: 'todos',
        fStatus: 'todos',
        fAlert: p.fAlert || '',
        svcs,
        clients: JSON.parse(JSON.stringify(CLIENTS0)),
        people,
        paid: Object.assign({}, PAID0),
        avisos: AVISOS0.map(a => ({ ...a })),
        openId: p.openId || null,
        modal: null,
        form: null,
        fErr: {},
        saving: false,
        assignSel: [],
        cancelMotivo: '',
        cancelScope: 'este',
        cliOpen: p.clienteId || null,
        cliQ: p.cliQ || '',
        cliTipo: 'todos',
        cform: null,
        cErr: {},
        memOpen: p.membroId || null,
        memTab: 'todos',
        mform: null,
        mErr: {},
        payPrest: 'todos',
        payPer: 'outubro',
        paySit: 'todos',
        payKey: null,
        payDate: br(TODAY),
        payObs: '',
        avTab: 'todos',
        toast: p.toast ? { msg: p.toast, kind: p.toastKind || 'ok' } : null,
        mTab: p.mTab || 'hoje',
        mScreen: p.mScreen || 'lista',
        mId: p.mId || 's17',
        photoKind: p.photoKind || 'antes',
        photoN: p.photoN || 0,
        photoStage: p.photoStage || 'escolher',
        oTipo: p.oTipo || '',
        oTexto: p.oTexto || '',
        oErr: '',
        oFoto: !!p.oFoto,
        cObs: '',
        mToast: p.mToast || null
      };
      const m = p.modal;
      if (m === 'form') {
        const v = p.formFor && svcs.find(x => x.id === p.formFor);
        st.form = v ? formFrom(v) : blankForm(day);
        if (p.formPreset === 'exemplo')
          Object.assign(st.form, {
            clienteId: 'c5',
            loc: '0',
            tipo: VID,
            data: '22/10/2026',
            ini: '10:00',
            fim: '13:00',
            orient: 'Vidros das sacadas e esquadrias após a obra. Cliente deixa a chave na portaria.',
            prest: ['patricia']
          });
        if (p.formErrors) st.fErr = validate(st.form);
        st.modal = 'form';
      }
      if (m === 'assign' && st.openId) {
        const v = svcs.find(x => x.id === st.openId);
        st.assignSel = p.assignPreset ? ['amaro', 'luciana'] : v.prest.slice();
        st.modal = 'assign';
      }
      if (m === 'cancel') st.modal = 'cancel';
      if (m === 'cliente') {
        st.cform = blankCli();
        st.modal = 'cliente';
      }
      if (m === 'membro') {
        st.mform = { id: null, nome: '', tel: '', perfil: 'Prestador', ativo: true };
        st.modal = 'membro';
      }
      if (m === 'pagamento') {
        st.payKey = p.payKey || 's2:amaro';
        st.modal = 'pagamento';
      }
      return st;
    }
    componentDidUpdate(pp) {
      const p = this.props || {},
        ch = {};
      if (p.role && p.role !== pp.role) ch.role = p.role;
      if (p.agendaState && p.agendaState !== pp.agendaState) ch.agState = p.agendaState;
      if (p.agendaMode && p.agendaMode !== pp.agendaMode) ch.amode = p.agendaMode;
      if (Object.keys(ch).length) this.setState(ch);
    }
    componentWillUnmount() {
      clearTimeout(this._tt);
      clearTimeout(this._mt);
      clearTimeout(this._lt);
    }
    toastOk(msg, kind) {
      this.setState({ toast: { msg, kind: kind || 'ok' } });
      clearTimeout(this._tt);
      this._tt = setTimeout(() => this.setState({ toast: null }), 3400);
    }
    mToastOk(msg) {
      this.setState({ mToast: msg });
      clearTimeout(this._mt);
      this._mt = setTimeout(() => this.setState({ mToast: null }), 3000);
    }
    load(patch) {
      this.setState(Object.assign({}, patch, { agState: 'carregando' }));
      clearTimeout(this._lt);
      this._lt = setTimeout(() => this.setState({ agState: 'normal' }), 600);
    }
    sel(value, onChange, opts, className) {
      return React.createElement(
        'select',
        { value, onChange, className: 'select' + (className ? ' ' + className : '') },
        opts.map(o => React.createElement('option', { key: o.v, value: o.v, disabled: !!o.d }, o.l))
      );
    }
    me() {
      return this.state.role === 'supervisor' ? 'Carlos Henrique Souza' : 'Walter Andrade';
    }
    updSvc(id, fn) {
      this.setState(st => ({ svcs: st.svcs.map(v => (v.id === id ? fn(v) : v)) }));
    }
    renderVals() {
      const s = this.state;
      const pById = Object.fromEntries(s.people.map(x => [x.id, x])),
        cById = Object.fromEntries(s.clients.map(c => [c.id, c]));
      const conf = conflictsOf(s.svcs);
      const prestAtivos = s.people.filter(x => x.perfil === 'Prestador' && x.ativo);
      const dec = v => {
        const c = cById[v.cli],
          loc = c.locais[v.loc] || c.locais[0];
        const cancel = v.status === 'cancelado';
        const semResp = v.prest.length === 0 && !cancel;
        const cf = conf[v.id] || [];
        const ocorr = v.ocorr.length > 0;
        return Object.assign({}, v, {
          cliente: c.nome,
          cliTipo: c.tipo,
          cliTel: c.tel,
          localNome: loc.nome,
          endereco: loc.end,
          bairro: loc.bairro,
          hora: v.ini + '–' + v.fim,
          dataBr: br(v.data),
          dataCurta: DOW[pd(v.data).getDay()] + ', ' + br(v.data),
          dowL: DOWL[pd(v.data).getDay()],
          st: ST[v.status],
          semResp,
          hasResp: v.prest.length > 0,
          ocorr,
          ocorrList: v.ocorr,
          nOcorr: v.ocorr.length,
          conflito: cf.length > 0,
          hasAlert: semResp || ocorr || cf.length > 0,
          confTxt: cf
            .map(
              x =>
                first(pById[x.pid].nome) +
                ' também está em ' +
                cById[x.o.cli].nome +
                ' (' +
                x.o.ini +
                '–' +
                x.o.fim +
                ')'
            )
            .join(' · '),
          avatars: v.prest.map(id => ({ i: ini(pById[id].nome) })),
          respTxt: v.prest.map(id => first(pById[id].nome)).join(', '),
          respFull: v.prest.length ? v.prest.map(id => pById[id].nome).join(', ') : '—',
          // sem responsável, conflito e cancelado nunca acontecem juntos
          stateCls: semResp ? 'is-sem' : cf.length ? 'is-conf' : cancel ? 'is-cancel' : '',
          isCancel: cancel,
          isRec: v.rec !== 'nao',
          recTxt: 'Repete: ' + REC[v.rec].toLowerCase(),
          onOpen: () => this.setState({ openId: v.id, cliOpen: null, memOpen: null })
        });
      };
      const all = s.svcs.map(dec).sort((a, b) => (a.data + a.ini).localeCompare(b.data + b.ini));
      const isMobile = s.mode === 'mobile' || (s.mode === 'proto' && s.role === 'prestador');
      const o = {
        showRoleBar: s.mode === 'proto',
        isDesktop: !isMobile,
        isMobile,
        phoneCls: s.mode === 'proto' ? 'is-framed' : ''
      };
      o.roles = [
        ['gestor', 'Gestor · Walter'],
        ['supervisor', 'Supervisor · Carlos'],
        ['prestador', 'Prestador · Amaro (celular)']
      ].map(([k, l]) => ({
        label: l,
        cls: s.role === k ? 'is-active' : '',
        onPick: () =>
          this.setState({
            role: k,
            modal: null,
            view: k === 'supervisor' && s.view === 'pagamentos' ? 'agenda' : s.view
          })
      }));
      o.hasToast = !!s.toast;
      o.toast = s.toast
        ? {
            msg: s.toast.msg,
            cls: s.toast.kind === 'erro' ? 'is-error' : '',
            icon: s.toast.kind === 'erro' ? 'error' : 'check_circle'
          }
        : {};
      const wk0 = monOf(TODAY);
      const nSemNow = all.filter(v => v.semResp && v.data >= wk0 && v.data <= addD(wk0, 6)).length;
      const unread = s.avisos.filter(a => !a.lido).length;
      const navI = (k, label, icon, badge, badgeCls) => ({
        label,
        icon,
        badge: String(badge || ''),
        hasBadge: !!badge,
        badgeCls: badgeCls || '',
        cls: s.view === k ? 'is-active' : '',
        onGo: () => this.setState({ view: k, openId: null, cliOpen: null, memOpen: null })
      });
      o.nav1 = [
        navI('agenda', 'Agenda', 'calendar_month', nSemNow),
        navI('clientes', 'Clientes', 'apartment'),
        navI('equipe', 'Equipe', 'groups')
      ];
      o.nav2 = (s.role === 'gestor' ? [navI('pagamentos', 'Pagamentos', 'payments')] : []).concat([
        navI('avisos', 'Avisos', 'notifications', unread, 'is-info')
      ]);
      o.user =
        s.role === 'supervisor'
          ? { nome: 'Carlos Henrique Souza', perfil: 'Supervisor', i: 'CH' }
          : { nome: 'Walter Andrade', perfil: 'Gestor', i: 'WA' };
      o.v = {
        agenda: s.view === 'agenda',
        clientes: s.view === 'clientes',
        equipe: s.view === 'equipe',
        pagamentos: s.view === 'pagamentos',
        avisos: s.view === 'avisos'
      };
      o.greeting =
        (s.role === 'supervisor' ? 'Olá, Carlos' : 'Olá, Walter') + ' · Terça-feira, 20/10/2026';
      // agenda
      const pass = v => {
        if (s.fPrest === 'sem' && !v.semResp) return false;
        if (s.fPrest !== 'todos' && s.fPrest !== 'sem' && !v.prest.includes(s.fPrest)) return false;
        if (s.fStatus !== 'todos' && v.status !== s.fStatus) return false;
        if (s.fAlert === 'sem' && !v.semResp) return false;
        if (s.fAlert === 'ocorr' && !v.ocorr) return false;
        if (s.fAlert === 'conf' && !v.conflito) return false;
        return true;
      };
      const wkEnd = addD(s.week, 5),
        vazia = s.agState === 'vazia';
      const inWeek = vazia ? [] : all.filter(v => v.data >= s.week && v.data <= wkEnd);
      const wkF = inWeek.filter(pass);
      const inDay = vazia ? [] : all.filter(v => v.data === s.day);
      const dayF = inDay.filter(pass);
      o.weekDays = range(6).map(i => {
        const d = addD(s.week, i);
        const items = wkF.filter(v => v.data === d);
        return {
          label: DOW[pd(d).getDay()],
          dateBr: br(d).slice(0, 5),
          countTxt: items.length ? items.length + (items.length > 1 ? ' serviços' : ' serviço') : '',
          items,
          none: items.length === 0,
          cls: d === TODAY ? 'is-today' : '',
          onDay: () => this.setState({ amode: 'dia', day: d })
        };
      });
      // Linha do tempo das 07:00 às 19:00. As classes hour-*, at-*, span-*, lane-* e lanes-*
      // ficam em assets/app.css (seção "Agenda: linha do tempo"), numa grade de 5 minutos.
      o.hours = range(12).map(i => ({ label: p2(7 + i) + ':00', cls: 'hour-' + i }));
      const slot = min => Math.min(144, Math.max(0, Math.round(min / 5)));
      const pos = v =>
        'at-' + slot(tm(v.ini) - 420) + ' span-' + Math.max(1, slot(tm(v.fim) - tm(v.ini)));
      const laneIt = items => {
        const ends = [];
        const r = items
          .filter(v => !v.isCancel)
          .map(v => {
            let l = ends.findIndex(e => e <= tm(v.ini));
            if (l < 0) {
              l = ends.length;
              ends.push(0);
            }
            ends[l] = tm(v.fim);
            return Object.assign({}, v, { posCls: pos(v) + ' lane-' + Math.min(l, 9) });
          });
        return { items: r, hCls: 'lanes-' + Math.min(Math.max(1, ends.length), 10) };
      };
      const rowsSrc = [{ id: '__sem', nome: 'Sem responsável', isSem: true }].concat(
        prestAtivos
          .filter(p => s.fPrest === 'todos' || s.fPrest === p.id)
          .map(p => ({ id: p.id, nome: p.nome }))
      );
      o.dayRows = rowsSrc
        .filter(r => !(r.isSem && s.fPrest !== 'todos' && s.fPrest !== 'sem'))
        .filter(r => s.fPrest !== 'sem' || r.isSem)
        .map(r => {
          const its = dayF.filter(v => (r.isSem ? v.semResp : v.prest.includes(r.id)));
          const L = laneIt(its);
          const hasConf = L.items.some(x => x.conflito);
          return {
            nome: r.nome,
            i: r.isSem ? '' : ini(r.nome),
            isSem: !!r.isSem,
            notSem: !r.isSem,
            sub: its.length
              ? its.length +
                (its.length > 1 ? ' serviços' : ' serviço') +
                (hasConf ? ' · conflito' : '')
              : r.isSem
                ? 'Nenhum pendente'
                : 'Disponível',
            subCls: hasConf ? 'is-conf' : its.length ? '' : 'is-free',
            items: L.items,
            hCls: L.hCls,
            cls: r.isSem ? 'is-sem' : ''
          };
        });
      o.isTodayDay = s.day === TODAY;
      o.listRows = wkF;
      const ag = s.agState,
        ok = ag !== 'carregando' && ag !== 'erro';
      const base = s.amode === 'dia' ? inDay : inWeek,
        filt = s.amode === 'dia' ? dayF : wkF;
      o.ag = {
        loading: ag === 'carregando',
        error: ag === 'erro',
        empty: ok && base.length === 0,
        emptyF: ok && base.length > 0 && filt.length === 0,
        week: ok && base.length > 0 && filt.length > 0 && s.amode === 'semana',
        day: ok && base.length > 0 && s.amode === 'dia' && filt.length > 0,
        list: ok && base.length > 0 && filt.length > 0 && s.amode === 'lista',
        emptyTitle: s.amode === 'dia' ? 'Nenhum serviço neste dia' : 'Nenhum serviço nesta semana'
      };
      o.skCols = range(6).map(i => ({
        cards: range([3, 2, 3, 2, 2, 1][i]).map(j => ({ cls: j % 2 ? 'is-short' : 'is-tall' }))
      }));
      o.rangeLabel =
        s.amode === 'dia'
          ? DOWL[pd(s.day).getDay()] + ', ' + br(s.day)
          : br(s.week).slice(0, 5) + ' a ' + br(wkEnd);
      o.amodes = [
        ['semana', 'Semana', 'view_week'],
        ['dia', 'Dia', 'view_day'],
        ['lista', 'Lista', 'list']
      ].map(([k, l, ic]) => ({
        label: l,
        icon: ic,
        cls: s.amode === k ? 'is-active' : '',
        onPick: () => this.setState({ amode: k })
      }));
      const nav = dir => {
        if (s.amode === 'dia') {
          let d = addD(s.day, dir);
          if (pd(d).getDay() === 0) d = addD(d, dir);
          this.load({ day: d, week: monOf(d) });
        } else this.load({ week: addD(s.week, 7 * dir), day: addD(s.day, 7 * dir) });
      };
      o.navPrev = () => nav(-1);
      o.navNext = () => nav(1);
      o.goToday = () => this.load({ week: monOf(TODAY), day: TODAY });
      o.retry = () => this.load({});
      o.selPrest = this.sel(
        s.fPrest,
        e => this.setState({ fPrest: e.target.value }),
        [
          { v: 'todos', l: 'Todos os prestadores' },
          { v: 'sem', l: 'Sem responsável' }
        ].concat(prestAtivos.map(p => ({ v: p.id, l: p.nome }))),
        'select--filter select--w220'
      );
      o.selStatus = this.sel(
        s.fStatus,
        e => this.setState({ fStatus: e.target.value }),
        [{ v: 'todos', l: 'Todos os status' }].concat(
          Object.keys(ST).map(k => ({ v: k, l: ST[k].label }))
        ),
        'select--filter select--w180'
      );
      const scope = s.amode === 'dia' ? inDay : inWeek;
      o.alertChips = [
        ['sem', 'person_off', 'sem responsável'],
        ['ocorr', 'report', 'com ocorrência'],
        ['conf', 'event_busy', 'em conflito']
      ].map(([k, ic, t]) => {
        const n = scope.filter(v =>
          k === 'sem' ? v.semResp : k === 'ocorr' ? v.ocorr : v.conflito
        ).length;
        const on = s.fAlert === k;
        return {
          label: n + ' ' + t,
          icon: ic,
          cls: 'chip-' + k + (on ? ' is-on' : ''),
          onPick: () => this.setState({ fAlert: on ? '' : k })
        };
      });
      o.hasFilters = s.fPrest !== 'todos' || s.fStatus !== 'todos' || !!s.fAlert;
      o.clearFilters = () => this.setState({ fPrest: 'todos', fStatus: 'todos', fAlert: '' });
      // detail drawer
      const ov = s.openId && all.find(v => v.id === s.openId);
      o.hasDrawer = !!ov && !isMobile;
      if (ov) {
        const idx = ['agendado', 'andamento', 'concluido'].indexOf(ov.status);
        o.d = Object.assign({}, ov, {
          antes: range(ov.fotos.antes).map(i => ({ lab: 'antes_' + p2(i + 1) + '.jpg' })),
          depois: range(ov.fotos.depois).map(i => ({ lab: 'depois_' + p2(i + 1) + '.jpg' })),
          noAntes: !ov.fotos.antes,
          noDepois: !ov.fotos.depois,
          hist: ov.hist
            .slice()
            .reverse()
            .map(h => Object.assign({}, h, { i: ini(h.autor) })),
          noOcorr: !ov.ocorrList.length,
          team: ov.prest.map(id => ({
            nome: pById[id].nome,
            tel: pById[id].tel,
            i: ini(pById[id].nome)
          })),
          canAct: !ov.isCancel,
          lastOcorr: ov.ocorrList.length ? ov.ocorrList[ov.ocorrList.length - 1].texto : '',
          steps: ['Agendado', 'Em andamento', 'Concluído'].map((l, i) => ({
            label: l,
            dotCls: ov.isCancel ? 'is-cancel' : i <= idx ? 'is-done' : '',
            textCls: i === idx ? 'is-current' : '',
            lineCls: i < idx ? 'is-done' : '',
            notLast: i < 2
          }))
        });
      } else
        o.d = {
          antes: [],
          depois: [],
          hist: [],
          ocorr: [],
          team: [],
          steps: [],
          avatars: [],
          st: {}
        };
      o.closeDrawer = () => this.setState({ openId: null });
      o.openEdit = () =>
        this.setState({
          modal: 'form',
          form: formFrom(s.svcs.find(v => v.id === s.openId)),
          fErr: {}
        });
      o.openAssign = () =>
        this.setState({
          modal: 'assign',
          assignSel: s.svcs.find(v => v.id === s.openId).prest.slice()
        });
      o.openCancel = () => this.setState({ modal: 'cancel', cancelMotivo: '', cancelScope: 'este' });
      o.openNew = () =>
        this.setState({
          modal: 'form',
          form: blankForm(
            s.amode === 'dia' ? s.day : s.week <= TODAY && TODAY <= wkEnd ? TODAY : s.week
          ),
          fErr: {}
        });
      o.closeModal = () =>
        this.setState(st => ({
          modal: null,
          saving: false,
          payKey: st.modal === 'pagamento' ? null : st.payKey
        }));
      o.m = {
        form: s.modal === 'form' && !!s.form,
        assign: s.modal === 'assign' && !!ov,
        cancel: s.modal === 'cancel' && !!ov,
        cliente: s.modal === 'cliente' && !!s.cform,
        membro: s.modal === 'membro' && !!s.mform,
        pagamento: s.modal === 'pagamento' && !!s.payKey
      };
      // availability
      const avail = (dIso, a, b, excl, selIds, onT) =>
        prestAtivos.map(p => {
          const busy =
            dIso && okT(a) && okT(b) && tm(b) > tm(a)
              ? s.svcs.filter(
                  v =>
                    v.id !== excl &&
                    v.status !== 'cancelado' &&
                    v.data === dIso &&
                    v.prest.includes(p.id) &&
                    tm(v.ini) < tm(b) &&
                    tm(a) < tm(v.fim)
                )
              : [];
          const on = selIds.includes(p.id);
          return {
            nome: p.nome,
            i: ini(p.nome),
            disp: busy.length
              ? 'Ocupado ' + busy[0].ini + '–' + busy[0].fim + ' · ' + cById[busy[0].cli].nome
              : dIso && okT(a) && okT(b)
                ? 'Disponível'
                : 'Informe data e horário',
            dispCls: busy.length ? 'is-busy' : dIso && okT(a) ? 'is-free' : '',
            boxCls: on ? 'is-on' : '',
            rowCls: on ? 'is-on' : busy.length ? 'is-busy' : '',
            onToggle: () => onT(p.id)
          };
        });
      const f = s.form;
      if (f) {
        const c = cById[f.clienteId];
        const e = s.fErr || {};
        const setF = k => ev => {
          const val = ev.target.value;
          this.setState(st => ({
            form: Object.assign({}, st.form, { [k]: val }, k === 'clienteId' ? { loc: '0' } : {}),
            fErr: Object.assign({}, st.fErr, { [k === 'clienteId' ? 'cliente' : k]: undefined })
          }));
        };
        const tog = id =>
          this.setState(st => ({
            form: Object.assign({}, st.form, {
              prest: st.form.prest.includes(id)
                ? st.form.prest.filter(x => x !== id)
                : st.form.prest.concat(id)
            })
          }));
        o.form = Object.assign({}, f, {
          title: f.id ? 'Editar serviço' : 'Novo serviço',
          endereco: c ? (c.locais[+f.loc] || {}).end : 'Selecione o cliente e o local',
          nSel: f.prest.length ? f.prest.length + ' selecionado(s)' : 'Nenhum selecionado',
          semPrest: !f.prest.length,
          showScope: !!f.id && f.origRec !== 'nao',
          saveLabel: s.saving ? 'Salvando…' : 'Salvar',
          saving: s.saving,
          notSaving: !s.saving
        });
        o.fSelCli = this.sel(
          f.clienteId,
          setF('clienteId'),
          [{ v: '', l: 'Selecione o cliente', d: true }].concat(
            s.clients.map(c => ({ v: c.id, l: c.nome + ' · ' + c.tipo }))
          ),
          e.cliente ? 'select--error' : ''
        );
        o.fSelLoc = this.sel(
          f.loc,
          setF('loc'),
          c ? c.locais.map((l, i) => ({ v: String(i), l: l.nome })) : [{ v: '0', l: '—' }]
        );
        o.fSelTipo = this.sel(
          f.tipo,
          setF('tipo'),
          [{ v: '', l: 'Selecione o tipo', d: true }].concat(TIPOS.map(t => ({ v: t, l: t }))),
          e.tipo ? 'select--error' : ''
        );
        o.fh = { data: setF('data'), ini: setF('ini'), fim: setF('fim'), orient: setF('orient') };
        o.fe = {
          cliente: e.cliente || '',
          tipo: e.tipo || '',
          data: e.data || '',
          ini: e.ini || '',
          fim: e.fim || ''
        };
        o.fx = { cliente: !!e.cliente, tipo: !!e.tipo, data: !!e.data, ini: !!e.ini, fim: !!e.fim };
        o.eb = {
          data: e.data ? 'is-error' : '',
          ini: e.ini ? 'is-error' : '',
          fim: e.fim ? 'is-error' : ''
        };
        o.fAvail = avail(brToIso(f.data), f.ini, f.fim, f.id, f.prest, tog);
        o.recOpts = Object.keys(REC).map(k => ({
          label: REC[k],
          cls: f.rec === k ? 'is-active' : '',
          onPick: () => this.setState(st => ({ form: Object.assign({}, st.form, { rec: k }) }))
        }));
        o.scopeOpts = [
          ['este', 'Somente este serviço', 'A alteração vale só para ' + f.data + '.'],
          [
            'proximos',
            'Este e os próximos',
            'Aplica a alteração a partir de ' + f.data + ' em toda a série.'
          ]
        ].map(([k, l, t]) => ({
          label: l,
          txt: t,
          on: f.scope === k,
          cls: f.scope === k ? 'is-active' : '',
          onPick: () => this.setState(st => ({ form: Object.assign({}, st.form, { scope: k }) }))
        }));
      } else {
        o.form = {};
        o.fh = {};
        o.fe = {};
        o.fx = {};
        o.eb = {};
        o.fAvail = [];
        o.recOpts = [];
        o.scopeOpts = [];
      }
      o.saveForm = () => {
        const f = this.state.form;
        const e = validate(f);
        if (Object.keys(e).length) {
          this.setState({ fErr: e });
          return;
        }
        this.setState({ saving: true, fErr: {} });
        setTimeout(() => {
          const autor = this.me(),
            now = br(TODAY) + ' ' + NOW,
            dIso = brToIso(f.data);
          const names = f.prest.map(id => pById[id].nome).join(', ');
          this.setState(st => {
            let svcs = st.svcs.slice();
            if (f.id) {
              svcs = svcs.map(v => {
                if (v.id !== f.id) return v;
                const h = v.hist.concat([
                  {
                    autor,
                    quando: now,
                    texto:
                      'Serviço editado' +
                      (v.rec !== 'nao'
                        ? f.scope === 'proximos'
                          ? ' — este e os próximos'
                          : ' — somente este serviço'
                        : '')
                  }
                ]);
                if (f.prest.join() !== v.prest.join())
                  h.push({
                    autor,
                    quando: now,
                    texto: f.prest.length ? 'Equipe atribuída: ' + names : 'Equipe removida'
                  });
                return Object.assign({}, v, {
                  cli: f.clienteId,
                  loc: +f.loc,
                  tipo: f.tipo,
                  data: dIso,
                  ini: f.ini,
                  fim: f.fim,
                  orient: f.orient,
                  prest: f.prest.slice(),
                  rec: f.rec,
                  hist: h
                });
              });
            } else {
              const h = [
                {
                  autor,
                  quando: now,
                  texto:
                    f.rec !== 'nao'
                      ? 'Serviço criado com repetição ' + REC[f.rec].toLowerCase()
                      : 'Serviço criado'
                }
              ];
              if (f.prest.length) h.push({ autor, quando: now, texto: 'Equipe atribuída: ' + names });
              svcs.push({
                id: 'n' + Date.now(),
                cli: f.clienteId,
                loc: +f.loc,
                tipo: f.tipo,
                data: dIso,
                ini: f.ini,
                fim: f.fim,
                orient: f.orient || '',
                prest: f.prest.slice(),
                status: 'agendado',
                fotos: { antes: 0, depois: 0 },
                ocorr: [],
                rec: f.rec,
                motivo: '',
                hist: h
              });
            }
            return {
              svcs,
              saving: false,
              modal: null,
              form: null,
              week: f.id ? st.week : monOf(dIso),
              day: f.id ? st.day : dIso,
              view: f.id ? st.view : 'agenda'
            };
          });
          this.toastOk(
            f.prest.length
              ? 'Serviço salvo com sucesso.'
              : 'Serviço salvo como pendente de distribuição.'
          );
        }, 700);
      };
      // assign
      if (ov) {
        o.aAvail = avail(ov.data, ov.ini, ov.fim, ov.id, s.assignSel, id =>
          this.setState(st => ({
            assignSel: st.assignSel.includes(id)
              ? st.assignSel.filter(x => x !== id)
              : st.assignSel.concat(id)
          }))
        );
        o.aNSel = s.assignSel.length + ' selecionado(s)';
        o.aNone = !s.assignSel.length;
      } else {
        o.aAvail = [];
      }
      o.saveAssign = () => {
        const sel = this.state.assignSel.slice(),
          id = this.state.openId;
        const names = sel.map(x => pById[x].nome).join(', ');
        this.updSvc(id, v =>
          Object.assign({}, v, {
            prest: sel,
            hist: v.hist.concat([
              {
                autor: this.me(),
                quando: br(TODAY) + ' ' + NOW,
                texto: sel.length ? 'Equipe atribuída: ' + names : 'Equipe removida'
              }
            ])
          })
        );
        this.setState({ modal: null });
        this.toastOk(
          sel.length
            ? 'Equipe atribuída: ' + sel.map(x => first(pById[x].nome)).join(', ') + '.'
            : 'Serviço sem responsável — pendente de distribuição.'
        );
      };
      o.cancelMotivo = s.cancelMotivo;
      o.onCancelMotivo = e => this.setState({ cancelMotivo: e.target.value });
      o.cancelScopes = [
        ['este', 'Somente este serviço'],
        ['proximos', 'Este e os próximos']
      ].map(([k, l]) => ({
        label: l,
        cls: s.cancelScope === k ? 'is-active' : '',
        onPick: () => this.setState({ cancelScope: k })
      }));
      o.confirmCancel = () => {
        const id = this.state.openId,
          mot = this.state.cancelMotivo.trim() || 'Não informado';
        this.updSvc(id, v =>
          Object.assign({}, v, {
            status: 'cancelado',
            motivo: mot,
            hist: v.hist.concat([
              {
                autor: this.me(),
                quando: br(TODAY) + ' ' + NOW,
                texto:
                  'Serviço cancelado' +
                  (v.rec !== 'nao'
                    ? this.state.cancelScope === 'proximos'
                      ? ' (este e os próximos)'
                      : ' (somente este)'
                    : '') +
                  '. Motivo: ' +
                  mot
              }
            ])
          })
        );
        this.setState({ modal: null });
        this.toastOk('Serviço cancelado.');
      };
      // clientes
      const q = s.cliQ.trim().toLowerCase();
      const tipoSt = t =>
        t === 'Recorrente'
          ? { cls: 'tone-recorrente', icon: 'event_repeat' }
          : { cls: 'tone-avulso', icon: 'event' };
      o.cliRows = s.clients
        .filter(
          c =>
            (s.cliTipo === 'todos' || c.tipo === s.cliTipo) &&
            (!q || c.nome.toLowerCase().includes(q) || c.tel.includes(q))
        )
        .map(c => {
          const sv = all.filter(v => v.cli === c.id);
          const past = sv.filter(v => v.data < TODAY || v.status === 'concluido');
          const nx = sv.find(
            v => v.data >= TODAY && v.status !== 'cancelado' && v.status !== 'concluido'
          );
          return Object.assign({}, c, {
            ts: tipoSt(c.tipo),
            i: ini(c.nome),
            nLoc: c.locais.length + (c.locais.length > 1 ? ' locais' : ' local'),
            total: String(sv.length),
            ultimo: past.length ? br(past[past.length - 1].data) : '—',
            proximo: nx ? br(nx.data) + ' · ' + nx.ini : '—',
            onOpen: () => this.setState({ cliOpen: c.id })
          });
        });
      o.noCli = !o.cliRows.length;
      o.cliQ = s.cliQ;
      o.onCliQ = e => this.setState({ cliQ: e.target.value });
      o.cliCount =
        s.clients.length +
        ' clientes · ' +
        s.clients.filter(c => c.tipo === 'Recorrente').length +
        ' recorrentes';
      o.cliTabs = [
        ['todos', 'Todos'],
        ['Recorrente', 'Recorrentes'],
        ['Avulso', 'Avulsos']
      ].map(([k, l]) => ({
        label: l,
        cls: s.cliTipo === k ? 'is-active' : '',
        onPick: () => this.setState({ cliTipo: k })
      }));
      const cc = s.cliOpen && cById[s.cliOpen];
      o.hasCli = !!cc && !ov;
      o.cd = cc
        ? Object.assign({}, cc, {
            ts: tipoSt(cc.tipo),
            hasObs: !!cc.obs,
            servicos: all
              .filter(v => v.cli === cc.id)
              .slice()
              .reverse(),
            nServ: all.filter(v => v.cli === cc.id).length + ' serviços'
          })
        : { ts: {}, locais: [], servicos: [] };
      o.closeCli = () => this.setState({ cliOpen: null });
      o.newForCli = () =>
        this.setState(st => ({
          modal: 'form',
          form: Object.assign(blankForm(TODAY), { clienteId: st.cliOpen }),
          fErr: {}
        }));
      o.openNewCli = () => this.setState({ modal: 'cliente', cform: blankCli(), cErr: {} });
      const cf = s.cform;
      if (cf) {
        const setC = k => e => {
          const val = e.target.value;
          this.setState(st => ({ cform: Object.assign({}, st.cform, { [k]: val }) }));
        };
        o.cform = cf;
        o.ch = { nome: setC('nome'), tel: setC('tel'), obs: setC('obs') };
        o.cTipos = ['Recorrente', 'Avulso'].map(t => ({
          label: t,
          cls: cf.tipo === t ? 'is-active' : '',
          onPick: () => this.setState(st => ({ cform: Object.assign({}, st.cform, { tipo: t }) }))
        }));
        const setL = (i, k) => e => {
          const val = e.target.value;
          this.setState(st => ({
            cform: Object.assign({}, st.cform, {
              locais: st.cform.locais.map((l, j) =>
                j === i ? Object.assign({}, l, { [k]: val }) : l
              )
            })
          }));
        };
        o.cLocais = cf.locais.map((l, i) => ({
          nome: l.nome,
          end: l.end,
          n: 'Local ' + (i + 1),
          onNome: setL(i, 'nome'),
          onEnd: setL(i, 'end'),
          canRm: cf.locais.length > 1,
          onRm: () =>
            this.setState(st => ({
              cform: Object.assign({}, st.cform, {
                locais: st.cform.locais.filter((_, j) => j !== i)
              })
            }))
        }));
        const ce = s.cErr || {};
        o.ce = { nome: ce.nome || '', tel: ce.tel || '', loc: ce.loc || '' };
        o.cx = { nome: !!ce.nome, tel: !!ce.tel, loc: !!ce.loc };
        o.ceb = { nome: ce.nome ? 'is-error' : '', tel: ce.tel ? 'is-error' : '' };
      } else {
        o.cform = {};
        o.ch = {};
        o.cTipos = [];
        o.cLocais = [];
        o.ce = {};
        o.cx = {};
        o.ceb = {};
      }
      o.addLocal = () =>
        this.setState(st => ({
          cform: Object.assign({}, st.cform, {
            locais: st.cform.locais.concat({ nome: '', end: '' })
          })
        }));
      o.saveCli = () => {
        const c = this.state.cform,
          e = {};
        if (!c.nome.trim()) e.nome = 'Informe o nome do cliente.';
        if (!/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/.test(c.tel))
          e.tel = 'Telefone inválido. Ex.: (11) 98765-4321';
        if (!c.locais.some(l => l.end.trim())) e.loc = 'Cadastre pelo menos um endereço.';
        if (Object.keys(e).length) {
          this.setState({ cErr: e });
          return;
        }
        const id = 'c' + Date.now();
        this.setState(st => ({
          clients: st.clients.concat({
            id,
            nome: c.nome.trim(),
            tel: c.tel,
            tipo: c.tipo,
            obs: c.obs,
            locais: c.locais
              .filter(l => l.end.trim())
              .map(l => ({
                nome: l.nome || 'Endereço principal',
                end: l.end,
                bairro: (l.end.split('–')[1] || '').split(',')[0].trim() || 'São Paulo'
              }))
          }),
          modal: null,
          cform: null,
          cliOpen: id
        }));
        this.toastOk('Cliente cadastrado.');
      };
      // equipe
      const team = s.people.filter(x => x.perfil !== 'Gestor');
      const wkS = monOf(TODAY),
        wkE = addD(wkS, 6);
      o.memTabs = [
        ['todos', 'Todos'],
        ['Supervisor', 'Supervisores'],
        ['Prestador', 'Prestadores']
      ].map(([k, l]) => ({
        label: l,
        cls: s.memTab === k ? 'is-active' : '',
        onPick: () => this.setState({ memTab: k })
      }));
      const perfSt = p => ({ cls: p === 'Supervisor' ? 'tone-supervisor' : 'tone-prestador' });
      o.memRows = team
        .filter(x => s.memTab === 'todos' || x.perfil === s.memTab)
        .map(x => {
          const sv = all.filter(
            v => v.prest.includes(x.id) && v.data >= wkS && v.data <= wkE && !v.isCancel
          );
          const cfN = sv.filter(v => v.conflito).length;
          return Object.assign({}, x, {
            i: ini(x.nome),
            ps: perfSt(x.perfil),
            sit: x.ativo ? 'Ativo' : 'Inativo',
            sitCls: x.ativo ? 'tone-ativo' : 'tone-inativo',
            nSem:
              x.perfil === 'Supervisor'
                ? 'Acompanha todos'
                : sv.length
                  ? sv.length + (sv.length > 1 ? ' serviços' : ' serviço')
                  : 'Nenhum',
            hasConf: cfN > 0,
            onOpen: () => this.setState({ memOpen: x.id })
          });
        });
      o.memCount =
        team.filter(x => x.perfil === 'Prestador' && x.ativo).length +
        ' prestadores ativos · ' +
        team.filter(x => x.perfil === 'Supervisor' && x.ativo).length +
        ' supervisor ativo';
      const mm = s.memOpen && pById[s.memOpen];
      o.hasMem = !!mm && !ov;
      if (mm) {
        const sv = all.filter(v => v.prest.includes(mm.id) && v.data >= wkS);
        const past = all.filter(v => v.prest.includes(mm.id) && v.data < wkS);
        o.md = Object.assign({}, mm, {
          i: ini(mm.nome),
          ps: perfSt(mm.perfil),
          sit: mm.ativo ? 'Ativo' : 'Inativo',
          sitCls: mm.ativo ? 'tone-ativo' : 'tone-inativo',
          servicos: sv,
          noServ: !sv.length,
          isSup: mm.perfil === 'Supervisor',
          isPrest: mm.perfil === 'Prestador',
          toggleLabel: mm.ativo ? 'Desativar acesso' : 'Reativar acesso',
          pastTxt: past.length + ' serviço(s) em semanas anteriores',
          acesso:
            mm.perfil === 'Supervisor'
              ? 'Vê a agenda completa, distribui serviços e acompanha a execução. Sem acesso a pagamentos.'
              : 'Vê apenas os próprios serviços no celular. Sem acesso a valores de outras pessoas ou dados administrativos.'
        });
      } else o.md = { servicos: [], ps: {} };
      o.closeMem = () => this.setState({ memOpen: null });
      o.toggleMem = () => {
        const id = this.state.memOpen;
        const was = pById[id].ativo;
        this.setState(st => ({
          people: st.people.map(x => (x.id === id ? Object.assign({}, x, { ativo: !x.ativo }) : x))
        }));
        this.toastOk(was ? 'Acesso desativado.' : 'Acesso reativado.');
      };
      o.openNewMem = () =>
        this.setState({
          modal: 'membro',
          mform: { id: null, nome: '', tel: '', perfil: 'Prestador', ativo: true },
          mErr: {}
        });
      o.openEditMem = () => {
        const x = pById[this.state.memOpen];
        this.setState({ modal: 'membro', mform: Object.assign({}, x), mErr: {} });
      };
      const mf = s.mform;
      if (mf) {
        const setM = k => e => {
          const val = e.target.value;
          this.setState(st => ({ mform: Object.assign({}, st.mform, { [k]: val }) }));
        };
        o.mform = Object.assign({}, mf, {
          title: mf.id ? 'Editar membro da equipe' : 'Novo membro da equipe'
        });
        o.mh = { nome: setM('nome'), tel: setM('tel') };
        o.mPerfis = ['Prestador', 'Supervisor'].map(t => ({
          label: t,
          cls: mf.perfil === t ? 'is-active' : '',
          onPick: () => this.setState(st => ({ mform: Object.assign({}, st.mform, { perfil: t }) }))
        }));
        o.mSits = [
          [true, 'Ativo'],
          [false, 'Inativo']
        ].map(([v, l]) => ({
          label: l,
          cls: mf.ativo === v ? 'is-active' : '',
          onPick: () => this.setState(st => ({ mform: Object.assign({}, st.mform, { ativo: v }) }))
        }));
        o.mPerfilTxt =
          mf.perfil === 'Supervisor'
            ? 'Supervisor: vê a agenda completa, distribui e acompanha serviços.'
            : 'Prestador: acessa pelo celular apenas os serviços atribuídos a ele.';
        const me = s.mErr || {};
        o.me = { nome: me.nome || '', tel: me.tel || '' };
        o.mx = { nome: !!me.nome, tel: !!me.tel };
        o.meb = { nome: me.nome ? 'is-error' : '', tel: me.tel ? 'is-error' : '' };
      } else {
        o.mform = {};
        o.mh = {};
        o.mPerfis = [];
        o.mSits = [];
        o.me = {};
        o.mx = {};
        o.meb = {};
      }
      o.saveMem = () => {
        const m = this.state.mform,
          e = {};
        if (!m.nome.trim()) e.nome = 'Informe o nome.';
        if (!/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/.test(m.tel))
          e.tel = 'Telefone inválido. Ex.: (11) 98765-4321';
        if (Object.keys(e).length) {
          this.setState({ mErr: e });
          return;
        }
        if (m.id)
          this.setState(st => ({
            people: st.people.map(x => (x.id === m.id ? Object.assign({}, m) : x)),
            modal: null,
            mform: null
          }));
        else {
          const id = 'u' + Date.now();
          this.setState(st => ({
            people: st.people.concat(Object.assign({}, m, { id })),
            modal: null,
            mform: null,
            memOpen: id
          }));
        }
        this.toastOk(
          m.id ? 'Cadastro atualizado.' : 'Membro cadastrado. O acesso será enviado por SMS.'
        );
      };
      // pagamentos
      const per = {
        outubro: ['2026-10-01', '2026-10-31'],
        atual: ['2026-10-19', '2026-10-25'],
        anterior: ['2026-10-12', '2026-10-18']
      }[s.payPer];
      let pr = [];
      all
        .filter(v => v.status === 'concluido')
        .forEach(v =>
          v.prest.forEach(pid => {
            const key = v.id + ':' + pid,
              pg = s.paid[key];
            pr.push({
              key,
              data: v.data,
              dataBr: v.dataBr,
              tipo: v.tipo,
              cliente: v.cliente,
              prest: pById[pid].nome,
              pid,
              valor: valor(v),
              valorTxt: money(valor(v)),
              pago: !!pg,
              pend: !pg,
              sit: pg ? 'Pago' : 'Pendente',
              sitCls: pg ? 'tone-pago' : 'tone-pendente',
              pagoEm: pg ? 'Pago em ' + pg.data : '',
              obs: pg ? pg.obs : '',
              onPay: () =>
                this.setState({ modal: 'pagamento', payKey: key, payDate: br(TODAY), payObs: '' })
            });
          })
        );
      pr = pr.filter(
        r => (s.payPrest === 'todos' || r.pid === s.payPrest) && r.data >= per[0] && r.data <= per[1]
      );
      const sumP = pr.filter(r => r.pend).reduce((a, r) => a + r.valor, 0),
        sumG = pr.filter(r => r.pago).reduce((a, r) => a + r.valor, 0);
      o.paySum = {
        pend: money(sumP),
        pago: money(sumG),
        nPend: pr.filter(r => r.pend).length + ' registro(s)',
        nPago: pr.filter(r => r.pago).length + ' registro(s)',
        total: money(sumP + sumG)
      };
      const prF = pr
        .filter(r => s.paySit === 'todos' || (s.paySit === 'pend' ? r.pend : r.pago))
        .sort((a, b) => b.data.localeCompare(a.data));
      o.payRows = prF;
      o.noPay = !prF.length;
      o.paySits = [
        ['todos', 'Todos'],
        ['pend', 'Pendentes'],
        ['pago', 'Pagos']
      ].map(([k, l]) => ({
        label: l,
        cls: s.paySit === k ? 'is-active' : '',
        onPick: () => this.setState({ paySit: k })
      }));
      o.selPayPrest = this.sel(
        s.payPrest,
        e => this.setState({ payPrest: e.target.value }),
        [{ v: 'todos', l: 'Todos os prestadores' }].concat(
          s.people.filter(x => x.perfil === 'Prestador').map(p => ({ v: p.id, l: p.nome }))
        ),
        'select--filter select--w220'
      );
      o.selPayPer = this.sel(
        s.payPer,
        e => this.setState({ payPer: e.target.value }),
        [
          { v: 'outubro', l: 'Outubro/2026' },
          { v: 'atual', l: 'Semana 19/10 a 25/10/2026' },
          { v: 'anterior', l: 'Semana 12/10 a 18/10/2026' }
        ],
        'select--filter select--w240'
      );
      const pk =
        s.payKey &&
        (() => {
          const [sid, pid] = s.payKey.split(':');
          const v = all.find(x => x.id === sid);
          return (
            v && {
              tipo: v.tipo,
              cliente: v.cliente,
              dataBr: v.dataBr,
              prest: pById[pid].nome,
              valorTxt: money(valor(v))
            }
          );
        })();
      o.pk = pk || {};
      o.payDate = s.payDate;
      o.payObs = s.payObs;
      o.onPayDate = e => this.setState({ payDate: e.target.value });
      o.onPayObs = e => this.setState({ payObs: e.target.value });
      o.payDateErr = !brToIso(s.payDate);
      o.payDateCls = brToIso(s.payDate) ? '' : 'is-error';
      o.confirmPay = () => {
        if (!brToIso(this.state.payDate)) return;
        const k = this.state.payKey;
        this.setState(st => ({
          paid: Object.assign({}, st.paid, { [k]: { data: st.payDate, obs: st.payObs || '—' } }),
          modal: null,
          payKey: null
        }));
        this.toastOk('Pagamento registrado.');
      };
      // avisos
      o.avTabs = [
        ['todos', 'Todos'],
        ['horario', 'Horários'],
        ['atribuicao', 'Atribuições'],
        ['ocorrencia', 'Ocorrências']
      ].map(([k, l]) => ({
        label: l,
        cls: s.avTab === k ? 'is-active' : '',
        onPick: () => this.setState({ avTab: k })
      }));
      o.avisos = s.avisos
        .filter(a => s.avTab === 'todos' || a.tipo === s.avTab)
        .map(a =>
          Object.assign({}, a, AVT[a.tipo], {
            tipoLabel: AVT[a.tipo].label,
            unread: !a.lido,
            cardCls: a.lido ? '' : 'is-unread',
            onOpen: () =>
              this.setState(st => ({
                avisos: st.avisos.map(x =>
                  x.id === a.id ? Object.assign({}, x, { lido: true }) : x
                ),
                view: 'agenda',
                openId: a.sid,
                week: monOf(st.svcs.find(v => v.id === a.sid).data)
              }))
          })
        );
      o.noAv = !o.avisos.length;
      o.unreadTxt = unread ? unread + ' não lido(s)' : 'Tudo lido';
      o.markAll = () =>
        this.setState(st => ({ avisos: st.avisos.map(a => Object.assign({}, a, { lido: true })) }));
      // mobile
      const mine = all.filter(v => v.prest.includes('amaro') && !v.isCancel);
      const mL = {
        hoje: mine.filter(v => v.data === TODAY),
        proximos: mine.filter(v => v.data > TODAY),
        concluidos: mine.filter(v => v.data < TODAY).reverse()
      };
      o.mTabs = [
        ['hoje', 'Hoje'],
        ['proximos', 'Próximos'],
        ['concluidos', 'Concluídos']
      ].map(([k, l]) => ({
        label: l + ' (' + mL[k].length + ')',
        cls: s.mTab === k ? 'is-active' : '',
        onPick: () => this.setState({ mTab: k })
      }));
      o.mList = mL[s.mTab].map(v =>
        Object.assign({}, v, {
          showDate: s.mTab !== 'hoje',
          onOpenM: () => this.setState({ mId: v.id, mScreen: 'detalhe' })
        })
      );
      o.mEmpty = !o.mList.length;
      o.mEmptyTxt = {
        hoje: 'Você não tem serviços hoje.',
        proximos: 'Nenhum serviço agendado para os próximos dias.',
        concluidos: 'Nenhum serviço concluído ainda.'
      }[s.mTab];
      const mv = all.find(v => v.id === s.mId) || mine[0];
      o.mv = Object.assign({}, mv, {
        isAg: mv.status === 'agendado',
        isAnd: mv.status === 'andamento',
        isConc: mv.status === 'concluido',
        colegas:
          mv.prest
            .filter(x => x !== 'amaro')
            .map(x => pById[x].nome)
            .join(', ') || 'Somente você',
        fotosTxt: 'Antes: ' + mv.fotos.antes + ' · Depois: ' + mv.fotos.depois,
        antes: range(Math.min(mv.fotos.antes, 3)).map(i => ({ lab: 'antes_' + p2(i + 1) })),
        depois: range(Math.min(mv.fotos.depois, 3)).map(i => ({ lab: 'depois_' + p2(i + 1) })),
        hasFotos: mv.fotos.antes + mv.fotos.depois > 0,
        depoisOk: mv.fotos.depois > 0,
        depoisMissing: !mv.fotos.depois,
        antesTxt: mv.fotos.antes + ' foto(s) de antes',
        depoisTxt: mv.fotos.depois
          ? mv.fotos.depois + ' foto(s) de depois'
          : 'Nenhuma foto de depois',
        iniTxt: (mv.hist.find(h => /Em andamento/.test(h.texto)) || { quando: '—' }).quando,
        concTxt:
          'Concluído em ' +
          (
            mv.hist.find(h => /Concluído/.test(h.texto)) || { quando: br(mv.data) + ' ' + mv.fim }
          ).quando.replace(' ', ' às ')
      });
      o.ms = {
        lista: s.mScreen === 'lista',
        detalhe: s.mScreen === 'detalhe',
        fotos: s.mScreen === 'fotos',
        ocorr: s.mScreen === 'ocorrencia',
        concluir: s.mScreen === 'concluir',
        sucesso: s.mScreen === 'sucesso'
      };
      o.mBack = () =>
        this.setState(st => ({ mScreen: st.mScreen === 'detalhe' ? 'lista' : 'detalhe' }));
      o.mHome = () => this.setState({ mScreen: 'lista', mTab: 'hoje' });
      o.hasMToast = !!s.mToast;
      o.mToast = s.mToast || '';
      o.mRoute = () => this.mToastOk('Abrindo rota no aplicativo de mapas…');
      const mNow = br(TODAY) + ' ' + NOW;
      o.mStart = () => {
        this.updSvc(mv.id, v =>
          Object.assign({}, v, {
            status: 'andamento',
            hist: v.hist.concat([
              { autor: 'Amaro Silva', quando: mNow, texto: 'Status alterado para Em andamento' }
            ])
          })
        );
        this.mToastOk('Serviço iniciado às ' + NOW + '.');
      };
      o.mGoFotos = () =>
        this.setState({
          mScreen: 'fotos',
          photoStage: 'escolher',
          photoN: 0,
          photoKind: mv.fotos.antes ? 'depois' : 'antes'
        });
      o.mGoFotosDepois = () =>
        this.setState({ mScreen: 'fotos', photoStage: 'escolher', photoN: 0, photoKind: 'depois' });
      o.mGoOcorr = () =>
        this.setState({ mScreen: 'ocorrencia', oTipo: '', oTexto: '', oErr: '', oFoto: false });
      o.mGoConcluir = () => this.setState({ mScreen: 'concluir', cObs: '' });
      o.photoKinds = [
        ['antes', 'Antes'],
        ['depois', 'Depois']
      ].map(([k, l]) => ({
        label: l,
        cls: s.photoKind === k ? 'is-active' : '',
        onPick: () => this.setState({ photoKind: k })
      }));
      o.photoTiles = range(s.photoN).map(i => ({
        lab: s.photoKind + '_' + p2(mv.fotos[s.photoKind] + i + 1) + '.jpg',
        onRm: () => this.setState(st => ({ photoN: Math.max(0, st.photoN - 1) }))
      }));
      o.noPhotos = !s.photoN;
      o.hasPhotos = s.photoN > 0;
      o.ps = {
        escolher: s.photoStage === 'escolher',
        enviando: s.photoStage === 'enviando',
        enviado: s.photoStage === 'enviado'
      };
      o.sendLabel = s.photoN
        ? 'Enviar ' + s.photoN + (s.photoN > 1 ? ' fotos' : ' foto')
        : 'Selecione as fotos';
      o.sendCls = s.photoN ? 'is-ready' : '';
      o.sentTxt =
        s.photoN +
        (s.photoN > 1 ? ' fotos de ' : ' foto de ') +
        s.photoKind +
        ' adicionada(s) ao serviço.';
      o.addCam = () => this.setState(st => ({ photoN: st.photoN + 1 }));
      o.addGal = () => this.setState(st => ({ photoN: st.photoN + 2 }));
      o.sendPhotos = () => {
        if (!this.state.photoN) return;
        this.setState({ photoStage: 'enviando' });
        setTimeout(() => {
          const n = this.state.photoN,
            k = this.state.photoKind;
          this.updSvc(mv.id, v =>
            Object.assign({}, v, {
              fotos: Object.assign({}, v.fotos, { [k]: v.fotos[k] + n }),
              hist: v.hist.concat([
                { autor: 'Amaro Silva', quando: mNow, texto: n + ' foto(s) de ' + k + ' enviada(s)' }
              ])
            })
          );
          this.setState({ photoStage: 'enviado' });
        }, 1100);
      };
      o.morePhotos = () => this.setState({ photoStage: 'escolher', photoN: 0 });
      o.oTipos = [
        'Dano no local',
        'Falta de material',
        'Sujeira não prevista',
        'Acesso ao local',
        'Cliente ausente',
        'Outro'
      ].map(t => ({
        label: t,
        cls: s.oTipo === t ? 'is-active' : '',
        onPick: () => this.setState({ oTipo: t })
      }));
      o.oTexto = s.oTexto;
      o.onOTexto = e => this.setState({ oTexto: e.target.value, oErr: '' });
      o.oErr = s.oErr;
      o.hasOErr = !!s.oErr;
      o.oTextCls = s.oErr ? 'is-error' : '';
      o.oFoto = s.oFoto;
      o.noOFoto = !s.oFoto;
      o.toggleOFoto = () => this.setState(st => ({ oFoto: !st.oFoto }));
      o.sendOcorr = () => {
        const st = this.state;
        if (!st.oTexto.trim()) {
          this.setState({ oErr: 'Descreva o que aconteceu para a supervisão entender.' });
          return;
        }
        const tipo = st.oTipo || 'Outro';
        this.updSvc(mv.id, v =>
          Object.assign({}, v, {
            ocorr: v.ocorr.concat({
              autor: 'Amaro Silva',
              quando: mNow,
              tipo,
              texto: st.oTexto.trim()
            }),
            hist: v.hist.concat([
              { autor: 'Amaro Silva', quando: mNow, texto: 'Ocorrência registrada: ' + tipo }
            ])
          })
        );
        this.setState(s2 => ({
          mScreen: 'detalhe',
          avisos: [
            {
              id: 'a' + Date.now(),
              tipo: 'ocorrencia',
              titulo: 'Ocorrência em ' + mv.cliente,
              texto: 'Amaro Silva: ' + st.oTexto.trim(),
              quando: mNow,
              lido: false,
              sid: mv.id
            }
          ].concat(s2.avisos)
        }));
        this.mToastOk('Ocorrência registrada. A supervisão foi informada.');
      };
      o.cObs = s.cObs;
      o.onCObs = e => this.setState({ cObs: e.target.value });
      o.confirmConc = () => {
        const obs = this.state.cObs.trim();
        this.updSvc(mv.id, v =>
          Object.assign({}, v, {
            status: 'concluido',
            hist: v.hist.concat([
              {
                autor: 'Amaro Silva',
                quando: mNow,
                texto: 'Status alterado para Concluído' + (obs ? '. Observação: ' + obs : '')
              }
            ])
          })
        );
        this.setState({ mScreen: 'sucesso' });
      };
      return o;
    }
  }

  return Component;
};
