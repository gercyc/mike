import type { MikeWorkflow } from "../shared/types";

export const BUILT_IN_WORKFLOWS_PTBR: MikeWorkflow[] = [
    {
        id: "builtin-cp-checklist-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Gerar Checklist de CP",
        type: "assistant",
        practice: "Transações Gerais",
        prompt_md:
            "## Gerar Checklist de Condições Precedentes (CP)\n\n" +
            "Analise o contrato de crédito ou documento de financiamento carregado e gere uma " +
            "checklist abrangente de Condições Precedentes (CP).\n\n" +
            "Você DEVE usar a ferramenta generate_docx para produzir a checklist como um documento Word para download. " +
            "Você DEVE passar landscape: true para a ferramenta generate_docx — o documento deve estar em orientação paisagem. " +
            "Não exiba a checklist inline — gere o arquivo .docx e forneça o link de download.\n\n" +
            "Estruture o documento da seguinte forma:\n" +
            "- Para cada categoria de condições (ex. Societária, Financeira, Jurídica, Garantias), adicione uma seção com um título\n" +
            "- Sob cada título de categoria, inclua uma tabela com exatamente estas quatro colunas nesta ordem:\n" +
            "  1. Índice — número sequencial dentro da categoria (1, 2, 3…)\n" +
            "  2. Número da Cláusula — a referência da cláusula ou anexo do contrato\n" +
            "  3. Cláusula — uma descrição concisa da condição precedente\n" +
            "  4. Status — deixe em branco (string vazia) para o usuário preencher\n\n" +
            "Use o campo table no objeto da seção (não content) para as linhas de cada categoria.",
        columns_config: null,
    },
    {
        id: "builtin-coc-dd-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de Mudança de Controle",
        type: "tabular",
        practice: "Societário",
        prompt_md:
            "## Revisão de Due Diligence de Mudança de Controle\n\n" +
            "Este workflow realiza uma revisão de due diligence de mudança de controle nos documentos selecionados.",
        columns_config: [
            {
                index: 0,
                name: "Partes",
                format: "bulleted_list",
                prompt: "Identifique todas as partes deste contrato. Para cada parte, informe sua razão social completa e seu papel (ex. contraparte, licenciador, credor, fornecedor).",
            },
            {
                index: 1,
                name: "Data",
                format: "date",
                prompt: "Qual é a data deste contrato? Se a data de início for diferente da data de assinatura, informe ambas.",
            },
            {
                index: 2,
                name: "Prazo",
                format: "text",
                prompt: "Qual é o prazo ou duração deste contrato? Informe as datas de início e término ou o comprimento do prazo.",
            },
            {
                index: 3,
                name: "Cláusula de Mudança de Controle",
                prompt: "Identifique e resuma a(s) cláusula(s) de mudança de controle neste documento. Cite a linguagem exata de disparo e especifique o que constitui uma 'mudança de controle'.",
            },
            {
                index: 4,
                name: "Consentimento Necessário",
                prompt: "Uma mudança de controle exige consentimento prévio de alguma parte? Identifique quem deve consentir, o prazo de notificação e quaisquer condições.",
            },
            {
                index: 5,
                name: "Direitos de Rescisão",
                prompt: "Quais direitos de rescisão surgem em caso de mudança de controle? Quem pode rescindir e quais são os requisitos de notificação?",
            },
            {
                index: 6,
                name: "Opções de Put/Call",
                prompt: "Há alguma opção de put ou call acionada por mudança de controle? Resuma os termos, preços e prazo de exercício.",
            },
            {
                index: 7,
                name: "Implicações Financeiras",
                prompt: "Quais são as implicações financeiras de uma mudança de controle? Inclua quaisquer taxas, pagamentos, obrigações aceleradas ou ajustes de preço.",
            },
        ],
    },
    {
        id: "builtin-credit-summary-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Resumo de Contrato de Crédito",
        type: "assistant",
        practice: "Finanças",
        prompt_md:
            "## Resumo de Contrato de Crédito\n\n" +
            "Analise o contrato de crédito carregado e produza um resumo jurídico abrangente cobrindo os seguintes tópicos. " +
            "Para cada seção, identifique as principais disposições, cite as referências de cláusula ou anexo relevantes e sinalize quaisquer termos incomuns, onerosos ou fora do mercado.\n\n" +
            "1. **Credores** — Todos os credores ou membros do sindicato de credores, incluindo sua razão social completa e papel (ex. agente de coordenação mandatado, credor original, banco agente)\n" +
            "2. **Devedores** — Todos os devedores, incluindo sua razão social completa e jurisdição de constituição\n" +
            "3. **Fiadores** — Todos os fiadores, incluindo sua razão social completa e o escopo de sua obrigação de fiança\n" +
            "4. **Outras Partes** — Quaisquer outras partes materiais (ex. agente de facilidade, agente de garantia, contrapartes de hedge, banco emissor) e seus papéis\n" +
            "5. **Data do Contrato** — Data do contrato de crédito\n" +
            "6. **Facilidades** — Cada facilidade disponível (ex. Facilidade de Crédito Rotativo, Empréstimo de Termo A, Empréstimo de Termo B, Empréstimo de Termo C), o tipo de facilidade, nome da tranche e quaisquer características estruturais principais\n" +
            "7. **Montante** — Valor total comprometido em todas as facilidades, a moeda e o detalhamento por tranche, se aplicável\n" +
            "8. **Finalidade** — Finalidade declarada para a qual os empréstimos podem ser utilizados e quaisquer restrições ao uso dos recursos\n" +
            "9. **Juros** — Taxa de referência aplicável (ex. SOFR, EURIBOR, taxa base), a margem, qualquer mecanismo de margem escalonada e como os períodos de juros são estruturados\n" +
            "10. **Taxa de Compromisso** — Taxas de compromisso ou utilização, a taxa aplicável, como são calculadas e a base (ex. compromisso não utilizado, utilização média)\n" +
            "11. **Cronograma de Amortização** — Perfil de amortização para cada facilidade, seja por prestações programadas ou amortização bullet, e as datas e valores de amortização\n" +
            "12. **Vencimento** — Data de vencimento final para cada facilidade\n" +
            "13. **Garantias** — Cada classe de garantia concedida ou exigida (ex. penhora de ações, hipotecas mobiliária e imobiliária, hipotecas imobiliárias, penhor de contas) e os ativos ou entidades sobre os quais as garantias são tomadas\n" +
            "14. **Fianças** — Obrigações de fiança, os fiadores, o escopo da fiança e quaisquer limitações (ex. limitações de fiança upstream, teste de cobertura de fiadores)\n" +
            "15. **Cláusulas Financeiras** — Cada cláusula financeira, a métrica (ex. razão de alavancagem, cobertura de juros, cobertura de caixa), o teste aplicável, a frequência de teste e quaisquer direitos de cura por capital próprio\n" +
            "16. **Eventos de Inadimplemento** — Cada evento de inadimplemento, observando quaisquer períodos de carência, limiares de materialidade ou disposições de inadimplemento cruzado\n" +
            "17. **Cessão** — Restrições ou permissões sobre cessão ou transferência (ex. listas brancas/negras, consentimento do devedor para transferências de credor; restrições à cessão pelo devedor)\n" +
            "18. **Mudança de Controle** — O que constitui uma mudança de controle, quais obrigações ela aciona (ex. pagamento antecipado obrigatório, cancelamento, consentimento do credor) e qualquer período de cura\n" +
            "19. **Taxa de Pagamento Antecipado** — Quaisquer taxas de pagamento antecipado, prêmios de make-whole ou proteções de soft-call, a taxa aplicável, o período durante o qual se aplica e quaisquer exceções (ex. pagamento com recursos de seguro ou alienação de ativos)\n" +
            "20. **Lei Aplicável** — Lei aplicável ao contrato\n" +
            "21. **Resolução de Disputas** — Se as disputas vão para litígio ou arbitragem, o fórum ou sede escolhido e quaisquer disposições de submissão à jurisdição\n\n" +
            "Entregue o resumo inline na sua resposta de chat — NÃO chame generate_docx. Somente produza um documento Word para download se o usuário solicitar explicitamente.",
        columns_config: null,
    },

    // ─── Contrato Comercial ───────────────────────────────────────────────────
    {
        id: "builtin-commercial-agreement-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de Contrato Comercial",
        type: "tabular",
        practice: "Transações Gerais",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Partes",
                format: "bulleted_list",
                prompt: "Identifique todas as partes deste contrato. Para cada parte, informe sua razão social completa, jurisdição de constituição (se declarada) e seu papel no contrato (ex. fornecedor, cliente, licenciador).",
            },
            {
                index: 1,
                name: "Escopo de Trabalho",
                format: "text",
                prompt: "Resuma o escopo de trabalho ou serviços a serem prestados sob este contrato. Quais são os principais entregáveis, obrigações ou serviços? Identifique quaisquer limitações ou exclusões ao escopo.",
            },
            {
                index: 2,
                name: "Altera Contrato Anterior",
                format: "yes_no",
                prompt: "Este contrato altera, reformula, suplementa ou substitui um contrato anterior? Se sim, identifique o contrato anterior pelo nome e data.",
            },
            {
                index: 3,
                name: "Data de Vigência",
                format: "date",
                prompt: "Qual é a data de vigência ou data de início deste contrato? Se nenhuma data explícita for declarada, informe quando ele é considerado em vigor.",
            },
            {
                index: 4,
                name: "Prazo",
                format: "text",
                prompt: "Qual é a duração ou prazo deste contrato? Informe o prazo inicial e quaisquer condições que afetem a duração.",
            },
            {
                index: 5,
                name: "Renovação",
                format: "text",
                prompt: "Quais disposições de renovação se aplicam? Especifique se a renovação é automática ou requer notificação, o período de renovação e quaisquer condições ou prazos de notificação necessários para evitar a renovação automática.",
            },
            {
                index: 6,
                name: "Preços",
                format: "text",
                prompt: "Qual é a estrutura de preços sob este contrato? Identifique todas as taxas, tarifas, encargos e condições de pagamento, incluindo moeda, cronograma de pagamento e requisitos de faturamento.",
            },
            {
                index: 7,
                name: "Ajustes de Preço",
                format: "text",
                prompt: "Há algum mecanismo de ajuste de preço neste contrato? Identifique qualquer indexação, vinculação ao IPC/IGP, benchmarking, ajustes baseados em volume ou outros mecanismos que permitam a alteração de preços ao longo do prazo.",
            },
            {
                index: 8,
                name: "Penalidades por Atraso de Pagamento",
                format: "text",
                prompt: "Quais penalidades ou consequências se aplicam por atraso de pagamento? Inclua quaisquer taxas de juros sobre valores vencidos, direitos de suspensão ou outras medidas disponíveis ao credor.",
            },
            {
                index: 9,
                name: "Valor Estimado do Contrato",
                format: "monetary_amount",
                prompt: "Qual é o valor total estimado ou declarado do contrato? Se nenhum valor único for fornecido, calcule ou estime com base nas taxas e prazo declarados. Informe a moeda e quaisquer premissas adotadas.",
            },
            {
                index: 10,
                name: "Limitação de Responsabilidade",
                format: "text",
                prompt: "Quais limitações de responsabilidade se aplicam? Identifique quaisquer limites de responsabilidade (incluindo como são calculados), exclusões de danos consequenciais ou indiretos e quaisquer exceções ao limite (ex. fraude, morte, violação de PI).",
            },
            {
                index: 11,
                name: "Titularidade e Licenciamento de PI",
                format: "text",
                prompt: "Como a titularidade e o licenciamento de propriedade intelectual são tratados? Identifique quem detém a PI pré-existente, quem detém a PI recém-criada e quais licenças são concedidas a cada parte. Observe quaisquer restrições de uso.",
            },
            {
                index: 12,
                name: "Mudança de Controle",
                format: "text",
                prompt: "Há uma disposição de mudança de controle? Se sim, descreva o que constitui uma mudança de controle, se é necessário consentimento e quais direitos (ex. rescisão, cessão) são acionados.",
            },
            {
                index: 13,
                name: "Força Maior",
                format: "text",
                prompt: "Resuma a cláusula de força maior. Quais eventos se qualificam, quais obrigações são suspensas, quanto tempo o evento deve persistir antes que a rescisão seja permitida e qual notificação é exigida?",
            },
            {
                index: 14,
                name: "Direitos de Rescisão",
                format: "text",
                prompt: "Quais são os direitos de rescisão de cada parte? Identifique a rescisão por conveniência (incluindo prazo de notificação), a rescisão por justa causa (incluindo períodos de cura) e as consequências da rescisão (ex. obrigações de pagamento, sobrevivência de termos).",
            },
            {
                index: 15,
                name: "Danos Estipulados",
                format: "text",
                prompt: "Há quaisquer disposições de danos estipulados? Se sim, identifique o que os aciona, a taxa ou fórmula aplicável, qualquer limite agregado de danos estipulados e se eles constituem a medida exclusiva.",
            },
            {
                index: 16,
                name: "Lei Aplicável",
                format: "text",
                prompt: "Qual lei aplicável rege este contrato? Informe a jurisdição e qualquer sistema jurídico específico referenciado.",
            },
            {
                index: 17,
                name: "Resolução de Disputas",
                format: "text",
                prompt: "Como as disputas são resolvidas sob este contrato? Identifique se as disputas vão para litígio ou arbitragem, o fórum ou sede escolhido, quaisquer etapas de escalada ou mediação obrigatórias antes dos procedimentos formais e o idioma dos procedimentos.",
            },
        ],
    },

    // ─── Contrato de Crédito ────────────────────────────────────────────────────────
    {
        id: "builtin-credit-agreement-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de Contrato de Crédito",
        type: "tabular",
        practice: "Finanças",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Credores",
                format: "bulleted_list",
                prompt: "Identifique todos os credores (ou o sindicato de credores) nomeados neste contrato. Para cada um, informe sua razão social completa e papel (ex. agente de coordenação mandatado, credor original, banco agente).",
            },
            {
                index: 1,
                name: "Devedores",
                format: "bulleted_list",
                prompt: "Identifique todos os devedores nomeados neste contrato, incluindo sua razão social completa e jurisdição de constituição.",
            },
            {
                index: 2,
                name: "Fiadores",
                format: "bulleted_list",
                prompt: "Identifique todos os fiadores nomeados neste contrato, incluindo sua razão social completa e o escopo de sua obrigação de fiança.",
            },
            {
                index: 3,
                name: "Outras Partes",
                format: "bulleted_list",
                prompt: "Identifique quaisquer outras partes materiais deste contrato (ex. agente de facilidade, agente de garantia, contrapartes de hedge, banco emissor). Informe seu nome e papel.",
            },
            {
                index: 4,
                name: "Data do Contrato",
                format: "date",
                prompt: "Qual é a data deste contrato de crédito?",
            },
            {
                index: 5,
                name: "Facilidade",
                format: "bulleted_list",
                prompt: "Liste cada facilidade disponível sob este contrato (ex. Facilidade de Crédito Rotativo, Empréstimo de Termo A, Empréstimo de Termo B, Empréstimo de Termo C). Para cada uma, informe o tipo de facilidade, nome da tranche e quaisquer características estruturais principais.",
            },
            {
                index: 6,
                name: "Montante",
                format: "monetary_amount",
                prompt: "Qual é o valor total comprometido disponível sob este contrato em todas as facilidades? Informe o valor, a moeda e o detalhamento por tranche, se aplicável.",
            },
            {
                index: 7,
                name: "Finalidade",
                format: "text",
                prompt: "Qual é a finalidade declarada para a qual os empréstimos sob este contrato podem ser utilizados? Identifique quaisquer restrições ao uso dos recursos.",
            },
            {
                index: 8,
                name: "Juros",
                format: "text",
                prompt: "Qual taxa de juros se aplica aos empréstimos sob este contrato? Identifique a taxa aplicável (ex. SOFR, EURIBOR, taxa base), a margem, qualquer mecanismo de margem escalonada e como os períodos de juros são estruturados.",
            },
            {
                index: 9,
                name: "Taxa de Compromisso",
                format: "text",
                prompt: "Há uma taxa de compromisso ou utilização? Se sim, informe a taxa aplicável, como é calculada e em que base (ex. compromisso não utilizado, utilização média).",
            },
            {
                index: 10,
                name: "Cronograma de Amortização",
                format: "text",
                prompt: "Resuma o cronograma de amortização para cada facilidade. Identifique se a amortização é por prestações programadas ou amortização bullet e informe as datas e valores de amortização onde especificados.",
            },
            {
                index: 11,
                name: "Vencimento",
                format: "date",
                prompt: "Qual é a data de vencimento final das facilidades sob este contrato? Se diferentes facilidades tiverem vencimentos diferentes, informe cada um.",
            },
            {
                index: 12,
                name: "Garantias",
                format: "bulleted_list",
                prompt: "Quais garantias são concedidas ou exigidas a serem concedidas sob este contrato? Liste cada classe de garantia (ex. penhora de ações, hipotecas mobiliária e imobiliária, hipotecas imobiliárias, penhor de contas) e os ativos ou entidades sobre os quais as garantias são tomadas.",
            },
            {
                index: 13,
                name: "Fianças",
                format: "bulleted_list",
                prompt: "Quais obrigações de fiança são dadas sob ou em conexão com este contrato? Identifique os fiadores, o escopo da fiança e quaisquer limitações (ex. limitações de fiança upstream, teste de cobertura de fiadores).",
            },
            {
                index: 14,
                name: "Cláusulas Financeiras",
                format: "bulleted_list",
                prompt: "Quais cláusulas financeiras estão incluídas neste contrato? Para cada cláusula, identifique a métrica (ex. razão de alavancagem, cobertura de juros, cobertura de caixa), o teste aplicável, a frequência de teste e quaisquer direitos de cura por capital próprio.",
            },
            {
                index: 15,
                name: "Eventos de Inadimplemento",
                format: "bulleted_list",
                prompt: "Liste os eventos de inadimplemento sob este contrato. Para cada um, observe quaisquer períodos de carência, limiares de materialidade ou disposições de inadimplemento cruzado.",
            },
            {
                index: 16,
                name: "Cessão",
                format: "text",
                prompt: "Quais restrições ou permissões se aplicam à cessão ou transferência de direitos sob este contrato? Identifique restrições às transferências de credor (ex. listas brancas/negras, consentimento do devedor) e à cessão pelo devedor.",
            },
            {
                index: 17,
                name: "Mudança de Controle",
                format: "text",
                prompt: "Há uma disposição de mudança de controle? Se sim, o que constitui uma mudança de controle, quais obrigações ela aciona (ex. pagamento antecipado obrigatório, cancelamento, consentimento do credor) e há algum período de cura?",
            },
            {
                index: 18,
                name: "Taxa de Pagamento Antecipado",
                format: "text",
                prompt: "Há quaisquer taxas de pagamento antecipado, prêmios de make-whole ou proteções de soft-call? Se sim, informe a taxa aplicável, o período durante o qual se aplica e quaisquer exceções (ex. pagamento com recursos de seguro ou alienação de ativos).",
            },
            {
                index: 19,
                name: "Lei Aplicável",
                format: "text",
                prompt: "Qual lei aplicável rege este contrato? Informe a jurisdição e qualquer sistema jurídico específico referenciado.",
            },
            {
                index: 20,
                name: "Resolução de Disputas",
                format: "text",
                prompt: "Como as disputas são resolvidas sob este contrato? Identifique se as disputas vão para litígio ou arbitragem, o fórum ou sede escolhido e quaisquer disposições de submissão à jurisdição.",
            },
        ],
    },

    // ─── E-Discovery ─────────────────────────────────────────────────────────────
    {
        id: "builtin-ediscovery-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de E-Discovery",
        type: "tabular",
        practice: "Litígio",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Data",
                format: "date",
                prompt: "Qual é a data deste documento? Para e-mails ou correspondências, use a data de envio. Para outros documentos, use a data de criação, assinatura ou a data mais proeminente exibida.",
            },
            {
                index: 1,
                name: "Tipo de Documento",
                format: "text",
                prompt: "Que tipo de documento é este? (ex. e-mail, memorando, carta, contrato, relatório, ata de reunião, mensagem de texto, fatura, apresentação). Seja específico.",
            },
            {
                index: 2,
                name: "Remetente",
                format: "text",
                prompt: "Quem é o remetente ou autor deste documento? Informe o nome completo, cargo e organização, quando identificáveis.",
            },
            {
                index: 3,
                name: "Destinatário(s)",
                format: "bulleted_list",
                prompt: "Quem são os destinatários deste documento? Liste todos os destinatários Para, CC e CCO, quando identificáveis. Informe o nome completo, cargo e organização de cada um. Observe se eles aparecem nos campos Para, CC ou CCO.",
            },
            {
                index: 4,
                name: "Resumo",
                format: "text",
                prompt: "Forneça um resumo factual conciso do conteúdo deste documento em 2–4 frases. Foque no assunto principal, quaisquer decisões tomadas, ações solicitadas ou informações transmitidas. Não inclua conclusões jurídicas.",
            },
            {
                index: 5,
                name: "Pessoas Mencionadas",
                format: "bulleted_list",
                prompt: "Liste todas as pessoas mencionadas neste documento (além do remetente e destinatários já identificados). Para cada pessoa, informe seu nome e, se discernível, seu papel ou organização.",
            },
            {
                index: 6,
                name: "Privilegiado?",
                format: "yes_no",
                prompt: "Este documento parece ser juridicamente privilegiado? Responda Sim se parece ser uma comunicação entre advogado e cliente feita para a finalidade predominante de obter ou dar aconselhamento jurídico, ou criada para a finalidade predominante de litígio. Responda Não caso contrário. Se incerto, observe a base da incerteza.",
            },
        ],
    },

    // ─── Contrato de Fornecimento ────────────────────────────────────────────────────────
    {
        id: "builtin-supply-agreement-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de Contrato de Fornecimento",
        type: "tabular",
        practice: "Transações Gerais",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Partes",
                format: "bulleted_list",
                prompt: "Identifique todas as partes deste contrato de fornecimento. Para cada uma, informe sua razão social completa, jurisdição de constituição (se declarada) e seu papel (ex. fornecedor, comprador, distribuidor).",
            },
            {
                index: 1,
                name: "Data de Vigência",
                format: "date",
                prompt: "Qual é a data de vigência ou data de início deste contrato? Se nenhuma data explícita for declarada, informe a data em que ele é considerado em vigor.",
            },
            {
                index: 2,
                name: "Produtos",
                format: "bulleted_list",
                prompt: "Quais produtos devem ser fornecidos sob este contrato? Liste cada produto ou categoria de produto, incluindo quaisquer especificações, números de peça ou normas referenciadas relevantes.",
            },
            {
                index: 3,
                name: "Prazo",
                format: "text",
                prompt: "Qual é o prazo ou duração inicial deste contrato? Informe a data de início (ou referência de quando começa) e a data de término ou duração.",
            },
            {
                index: 4,
                name: "Renovação",
                format: "text",
                prompt: "Quais disposições de renovação se aplicam? A renovação é automática ou por acordo? Informe o período de renovação, requisitos de notificação para evitar renovação e quaisquer condições de renovação.",
            },
            {
                index: 5,
                name: "Entrega",
                format: "text",
                prompt: "Quais obrigações e termos de entrega se aplicam? Identifique os termos de entrega (ex. Incoterms), prazos de entrega, locais de entrega, risco de perda e quaisquer consequências por entrega atrasada ou não realizada.",
            },
            {
                index: 6,
                name: "Qualidade",
                format: "text",
                prompt: "Quais normas ou especificações de qualidade se aplicam aos produtos? Identifique quaisquer normas aplicáveis (ex. ISO, requisitos regulatórios), direitos de inspeção, procedimentos de aceitação e consequências de não conformidade.",
            },
            {
                index: 7,
                name: "Garantias",
                format: "text",
                prompt: "Quais garantias o fornecedor concede em relação aos produtos? Informe o período de garantia, o escopo da garantia (ex. livres de defeitos, conformidade com especificações), a reparação por descumprimento (ex. reparo, substituição, reembolso) e quaisquer exclusões.",
            },
            {
                index: 8,
                name: "Danos Estipulados",
                format: "text",
                prompt: "Há quaisquer disposições de danos estipulados? Se sim, identifique o que os aciona (ex. atraso de entrega, descumprimento de normas de qualidade), a taxa ou fórmula aplicável, qualquer limite agregado e se são declarados como a medida exclusiva.",
            },
            {
                index: 9,
                name: "Limitação de Responsabilidade",
                format: "text",
                prompt: "Quais limitações de responsabilidade se aplicam? Identifique quaisquer limites de responsabilidade (e como são calculados, ex. valor do contrato, taxas pagas), exclusões de danos consequenciais ou indiretos e quaisquer exceções à limitação (ex. fraude, dolo, morte ou lesão pessoal).",
            },
            {
                index: 10,
                name: "Força Maior",
                format: "text",
                prompt: "Resuma a cláusula de força maior. Quais eventos se qualificam, quais obrigações são suspensas, qual notificação deve ser dada, quanto tempo o evento deve persistir antes que qualquer parte possa rescindir e quais são as consequências da rescisão por força maior?",
            },
            {
                index: 11,
                name: "Direitos de Rescisão",
                format: "text",
                prompt: "Quais são os direitos de rescisão de cada parte? Distinga entre rescisão por conveniência (incluindo prazo de notificação) e rescisão por justa causa (incluindo períodos de cura e gatilhos). Observe o que acontece na rescisão, incluindo quaisquer ordens de compra pendentes ou obrigações de pagamento.",
            },
            {
                index: 12,
                name: "Lei Aplicável",
                format: "text",
                prompt: "Qual lei aplicável rege este contrato? Informe a jurisdição e qualquer sistema jurídico específico referenciado.",
            },
            {
                index: 13,
                name: "Resolução de Disputas",
                format: "text",
                prompt: "Como as disputas são resolvidas sob este contrato? Identifique se as disputas vão para litígio ou arbitragem, o fórum ou sede escolhido e quaisquer etapas de escalada obrigatórias (ex. negociação, mediação) antes dos procedimentos formais.",
            },
        ],
    },

    // ─── SPA ─────────────────────────────────────────────────────────────────────
    {
        id: "builtin-spa-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de SPA",
        type: "tabular",
        practice: "Societário",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Partes",
                format: "bulleted_list",
                prompt: "Identifique todas as partes deste contrato de compra e venda de ações. Para cada uma, informe sua razão social completa, jurisdição de constituição (se declarada) e seu papel (ex. vendedor, comprador, empresa-alvo, garantidor).",
            },
            {
                index: 1,
                name: "Data",
                format: "date",
                prompt: "Qual é a data deste contrato de compra e venda de ações?",
            },
            {
                index: 2,
                name: "Transação",
                format: "text",
                prompt: "Resuma a transação. Quais ações ou participações estão sendo adquiridas, em qual empresa-alvo ou empresas, e qual é a natureza da transação (ex. aquisição de 100%, participação majoritária, investimento minoritário)?",
            },
            {
                index: 3,
                name: "Contraprestação",
                format: "monetary_amount",
                prompt: "Qual é a contraprestação pagável sob este contrato? Informe o preço total de referência, a moeda e a estrutura (ex. dinheiro, ações, notas promissórias, contraprestação diferida, earnout). Se o preço estiver sujeito a ajuste (ex. locked box, demonstrações de fechamento), descreva o mecanismo.",
            },
            {
                index: 4,
                name: "Condições Precedentes Principais",
                format: "bulleted_list",
                prompt: "Liste as condições precedentes (CPs) principais para o fechamento. Para cada CP, informe o que deve ser satisfeito ou renunciado e por quem. Identifique qualquer data limite pela qual as CPs devem ser satisfeitas.",
            },
            {
                index: 5,
                name: "Data de Fechamento",
                format: "text",
                prompt: "Quando ocorre o fechamento? Informe quantos dias úteis após a satisfação ou renúncia de todas as CPs o fechamento deve ocorrer e/ou qualquer data limite fixa para o fechamento. Observe se há alguma obrigação de fechar até uma data específica após a assinatura.",
            },
            {
                index: 6,
                name: "Garantias",
                format: "text",
                prompt: "Resuma o pacote de garantias. Quem dá as garantias (ex. vendedor, gestão, todos os vendedores solidariamente)? Há garantias de negócio e/ou de titularidade? Identifique o escopo de qualquer processo de divulgação de garantias e quaisquer limitações às reclamações de garantia (ex. prazos, limiares mínimos, limite agregado).",
            },
            {
                index: 7,
                name: "Indenizações",
                format: "text",
                prompt: "Há indenizações específicas neste contrato? Se sim, liste as principais indenizações concedidas, por quem e para quais responsabilidades potenciais (ex. indenização tributária, indenização ambiental, indenização por litígio). Observe quaisquer prazos ou limites aplicáveis às reclamações de indenização.",
            },
            {
                index: 8,
                name: "Limitação de Responsabilidade",
                format: "text",
                prompt: "Quais limitações de responsabilidade se aplicam às reclamações de garantia e indenização? Identifique o limite agregado (e como é calculado, ex. como percentual da contraprestação), qualquer limite separado para garantias fundamentais ou indenizações, limiares mínimos de reclamação (de minimis e basket/deductible) e prazos para apresentar reclamações.",
            },
            {
                index: 9,
                name: "Restrições",
                format: "text",
                prompt: "Quais restrições ou outras obrigações são assumidas pelo vendedor ou gestão? Inclua não concorrência, não solicitação e não contratação, informando o escopo (atividades e geografia) e a duração de cada uma.",
            },
            {
                index: 10,
                name: "Exclusividade",
                format: "text",
                prompt: "Há uma disposição de exclusividade ou no-shop neste contrato? Se sim, informe o período de exclusividade, quais atividades são restritas (ex. solicitar ofertas concorrentes, interagir com terceiros) e quaisquer exceções ou acordos de taxa de rescisão.",
            },
            {
                index: 11,
                name: "Lei Aplicável e Jurisdição",
                format: "text",
                prompt: "Qual lei aplicável rege este contrato e quais tribunais ou câmaras arbitrais têm jurisdição? Informe a lei escolhida, o fórum para disputas e se a jurisdição é exclusiva ou não exclusiva.",
            },
            {
                index: 12,
                name: "Resolução de Disputas",
                format: "text",
                prompt: "Como as disputas devem ser resolvidas sob este contrato? Identifique se as disputas vão para litígio ou arbitragem, a sede ou fórum escolhido, as normas aplicáveis (se arbitragem) e quaisquer etapas obrigatórias de escalada pré-disputa.",
            },
        ],
    },

    // ─── NDA ─────────────────────────────────────────────────────────────────────
    {
        id: "builtin-nda-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de NDA",
        type: "tabular",
        practice: "Transações Gerais",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Direção",
                format: "tag",
                tags: ["Mútuo", "Unilateral"],
                prompt: "Este NDA é mútuo (ambas as partes devem obrigações de confidencialidade uma à outra) ou unilateral (apenas uma parte deve obrigações de confidencialidade)? Identifique a direção e nomeie a parte divulgadora e a parte receptora ou partes.",
            },
            {
                index: 1,
                name: "Definição de Informação Confidencial",
                format: "text",
                prompt: "Como 'Informação Confidencial' é definida neste contrato? É amplamente ou restritamente redigida? A informação deve ser marcada como confidencial, ou toda informação compartilhada em conexão com a finalidade é automaticamente coberta? Observe quaisquer inclusões ou exclusões expressas.",
            },
            {
                index: 2,
                name: "Obrigações da Parte Receptora",
                format: "bulleted_list",
                prompt: "Quais são as principais obrigações da parte receptora em relação à informação confidencial? Liste cada obrigação (ex. manter confidencialidade, não divulgar a terceiros, usar apenas para a finalidade permitida, aplicar um padrão de cuidado específico, restringir acesso a pessoal com necessidade de saber).",
            },
            {
                index: 3,
                name: "Exceções Padrão Presentes?",
                format: "yes_no",
                prompt: "O contrato inclui as exceções padrão às obrigações de confidencialidade? Responda Sim se o contrato excluir informação que: (a) é ou se torna disponível publicamente sem violação; (b) já era conhecida pela parte receptora; (c) é desenvolvida independentemente; e (d) é recebida de um terceiro sem restrição. Observe quaisquer exceções que estejam ausentes ou redigidas de forma diferente da formulação padrão.",
            },
            {
                index: 4,
                name: "Divulgações Permitidas",
                format: "bulleted_list",
                prompt: "A quem a parte receptora pode divulgar informação confidencial? Liste cada categoria de destinatário permitido (ex. empregados, consultores profissionais, afiliadas, partes financiadoras, autoridades regulatórias). Observe se a divulgação subsequente exige que o destinatário esteja vinculado por obrigações equivalentes.",
            },
            {
                index: 5,
                name: "Prazo e Duração",
                format: "text",
                prompt: "Qual é o prazo deste NDA e quanto tempo duram as obrigações de confidencialidade? Informe o prazo inicial do contrato e a duração das obrigações de confidencialidade (observando se elas sobrevivem à rescisão e por quanto tempo).",
            },
            {
                index: 6,
                name: "Devolução e Destruição",
                format: "text",
                prompt: "Quais obrigações se aplicam na expiração ou rescisão quanto à devolução ou destruição da informação confidencial? Há uma escolha entre devolução e destruição? A destruição deve ser certificada? Há quaisquer exceções de retenção (ex. para fins regulatórios, sistemas de backup de TI)?",
            },
            {
                index: 7,
                name: "Remédios",
                format: "text",
                prompt: "Quais remédios estão disponíveis por violação das obrigações de confidencialidade? O contrato reconhece que danos podem ser inadequados e que medida liminar ou execução específica está disponível? Há quaisquer danos estipulados acordados ou indenizações por violação?",
            },
            {
                index: 8,
                name: "Lei Aplicável e Jurisdição",
                format: "text",
                prompt: "Qual lei aplicável rege este contrato e quais tribunais têm jurisdição? Informe a lei escolhida, o fórum e se a jurisdição é exclusiva ou não exclusiva.",
            },
        ],
    },

    // ─── Contrato de Locação Comercial ─────────────────────────────────────────────────────────
    {
        id: "builtin-commercial-lease-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de Contrato de Locação Comercial",
        type: "tabular",
        practice: "Imobiliário",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Locador",
                format: "text",
                prompt: "Quem é o locador sob este contrato de locação? Informe a razão social completa, jurisdição de constituição ou registro (se aplicável) e qualquer endereço registrado ou número de matrícula informado.",
            },
            {
                index: 1,
                name: "Locatário",
                format: "text",
                prompt: "Quem é o locatário sob este contrato de locação? Informe a razão social completa, jurisdição de constituição ou registro (se aplicável) e qualquer endereço registrado informado.",
            },
            {
                index: 2,
                name: "Fiador",
                format: "text",
                prompt: "Há um fiador sob este contrato de locação? Se sim, informe o nome completo do fiador e o escopo da fiança (ex. fiança integral das obrigações do locatário, ou limitada a obrigações específicas). Se não houver fiador, informe isso explicitamente.",
            },
            {
                index: 3,
                name: "Imóvel",
                format: "text",
                prompt: "Descreva o imóvel locado sob este contrato. Inclua o endereço, andar(es), referência de unidade, área interna líquida (se informada) e quaisquer áreas incluídas ou excluídas da locação (ex. áreas comuns, cobertura, estrutura, estacionamento).",
            },
            {
                index: 4,
                name: "Data da Locação",
                format: "date",
                prompt: "Qual é a data deste contrato de locação? Se o contrato estiver sem data ou se a data de início do prazo diferir da data de execução, observe ambas.",
            },
            {
                index: 5,
                name: "Prazo",
                format: "text",
                prompt: "Qual é o prazo contratual desta locação? Informe a duração do prazo e as datas de início e término do prazo.",
            },
            {
                index: 6,
                name: "Aluguel",
                format: "monetary_amount",
                prompt: "Qual é o aluguel anual inicial pagável sob esta locação? Informe o valor, a moeda, a frequência de pagamento (ex. trimestral antecipado) e as datas de pagamento. Observe qualquer período de carência ou aluguel concessionário inicial.",
            },
            {
                index: 7,
                name: "Reajuste de Aluguel",
                format: "text",
                prompt: "Há disposições de reajuste de aluguel? Se sim, informe as datas ou frequência de revisão, o mecanismo de revisão (ex. revisão de mercado aberto, indexação ao IGP/IPC, reajuste fixo), se a revisão é apenas para cima, quaisquer premissas e desconsiderações aplicáveis a uma revisão de mercado aberto e o mecanismo de resolução de disputas se as partes não concordarem com o aluguel revisado.",
            },
            {
                index: 8,
                name: "Taxa de Condomínio",
                format: "text",
                prompt: "O locatário é responsável por uma taxa de condomínio? Se sim, descreva quais custos estão incluídos na taxa de condomínio, a cota de rateio ou percentual do locatário, qualquer limite da taxa de condomínio e como a taxa é administrada e reconciliada.",
            },
            {
                index: 9,
                name: "Seguro",
                format: "text",
                prompt: "Quais são as obrigações de seguro sob esta locação? Informe quem faz o seguro (locador ou locatário), quais riscos devem ser cobertos, quem arca com o custo do prêmio do seguro e as obrigações do locatário em relação ao seguro do locador (ex. não invalidar a apólice, pagar o prêmio como aluguel adicional).",
            },
            {
                index: 10,
                name: "Uso Permitido",
                format: "text",
                prompt: "Qual é o uso permitido do imóvel sob esta locação? Informe a classe de uso ou uso específico permitido e identifique quaisquer restrições de uso. Observe se o consentimento do locador é necessário para mudar de uso e em que base o consentimento pode ser recusado.",
            },
            {
                index: 11,
                name: "Reparos e Manutenção",
                format: "text",
                prompt: "Quem é responsável pelos reparos e manutenção do imóvel? Descreva a extensão da obrigação de reparos do locatário (ex. reparos integrais, reparos internos apenas, sujeita a um laudo de vistoria). Informe as obrigações de reparos do locador, se houver, em relação à estrutura, exterior ou áreas comuns.",
            },
            {
                index: 12,
                name: "Modificações",
                format: "text",
                prompt: "Quais modificações o locatário pode fazer no imóvel? Distinga entre modificações estruturais e não estruturais. O consentimento do locador é necessário e, em caso afirmativo, em que base pode ser recusado? O locatário deve desfazer as modificações ao final do prazo?",
            },
            {
                index: 13,
                name: "Cessão e Sublocação",
                format: "text",
                prompt: "Quais direitos o locatário tem para ceder ou sublocar o imóvel? Informe se a cessão e sublocação são permitidas com consentimento do locador, em que fundamentos o consentimento pode ser recusado, quaisquer condições a serem satisfeitas (ex. contrato de garantia de locatário autorizado na cessão, aluguel não inferior ao aluguel vigente na sublocação) e se quaisquer negócios são proibidos integralmente.",
            },
            {
                index: 14,
                name: "Direitos de Rescisão Antecipada",
                format: "text",
                prompt: "Há quaisquer direitos de rescisão antecipada nesta locação? Se sim, identifique quem detém o direito de rescisão (locador, locatário ou ambos), a(s) data(s) de rescisão, o prazo e forma de notificação necessários para exercer o direito de rescisão e quaisquer pré-condições para o exercício efetivo (ex. descumprimento não material, imóvel livre, pagamento de todos os valores devidos).",
            },
            {
                index: 15,
                name: "Estabilidade da Locação",
                format: "yes_no",
                prompt: "O locatário tem estabilidade da locação por força de lei (ex. sob a Lei do Inquilinato no Brasil, ou legislação equivalente em outra jurisdição)? Responda Sim se a locação se beneficia de estabilidade da locação. Responda Não se a locação foi excluída da estabilidade ou se ela não se aplica. Informe a base para sua resposta.",
            },
            {
                index: 16,
                name: "Obrigações de Reintegração",
                format: "text",
                prompt: "Quais obrigações de reintegração se aplicam ao final do prazo? Descreva as obrigações do locatário de restituição do imóvel (ex. entregar o imóvel em estado de reparo, desfazer modificações, repintar). Há um laudo de vistoria limitando a responsabilidade do locatário? Observe qualquer limite ou outra limitação à reclamação do locador.",
            },
            {
                index: 17,
                name: "Caução",
                format: "monetary_amount",
                prompt: "É exigida uma caução ou depósito? Se sim, informe o valor, o período pelo qual é mantido, as condições sob as quais o locador pode recorrer a ele e as circunstâncias em que é devolvido ao locatário.",
            },
            {
                index: 18,
                name: "Rescisão e Despejo",
                format: "text",
                prompt: "Quais são os direitos de rescisão ou despejo do locador? Identifique os eventos que dão ao locador o direito de rescindir a locação (ex. não pagamento do aluguel após prazo de carência, descumprimento material de obrigação, insolvência) e quaisquer requisitos de notificação antes que a rescisão possa ser exercida.",
            },
            {
                index: 19,
                name: "Lei Aplicável",
                format: "text",
                prompt: "Qual lei aplicável rege esta locação e quais tribunais têm jurisdição sobre as disputas?",
            },
        ],
    },

    // ─── Contrato de Sociedade Limitada ───────────────────────────────────────────
    {
        id: "builtin-lpa-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de Contrato de Sociedade Limitada",
        type: "tabular",
        practice: "Private Equity",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Sócio Administrador",
                format: "text",
                prompt: "Identifique o(s) Sócio(s) Administrador(es) do fundo. Informe a razão social completa, jurisdição de constituição e qualquer entidade de gestão afiliada (ex. gestor do fundo ou consultor de investimentos) nomeada no contrato.",
            },
            {
                index: 1,
                name: "Nome e Jurisdição do Fundo",
                format: "text",
                prompt: "Qual é o nome completo do fundo e em qual jurisdição a sociedade limitada é constituída ou registrada?",
            },
            {
                index: 2,
                name: "Capital Comprometido Total",
                format: "monetary_amount",
                prompt: "Qual é o capital comprometido total do fundo? Informe o tamanho alvo, qualquer limite máximo, a moeda e a(s) data(s) de fechamento, se especificadas.",
            },
            {
                index: 3,
                name: "Chamadas de Capital e Aportes",
                format: "text",
                prompt: "Como e quando o SA pode chamar capital dos SCs? Informe o prazo de notificação para chamadas de capital, a mecânica para emitir um aviso de chamada, qualquer limite à frequência ou tamanho das chamadas e se compromissos não aportados podem ser rechamados após reembolso.",
            },
            {
                index: 4,
                name: "Penalidades por Falta de Aporte",
                format: "text",
                prompt: "Quais são as consequências se um SC falhar em aportar uma chamada de capital? Descreva quaisquer penalidades (ex. juros sobre o déficit, diluição do interesse, transferência forçada com desconto, perda de direitos de voto ou distribuição, exclusão de investimentos futuros). Há quaisquer períodos de cura antes que as penalidades se apliquem?",
            },
            {
                index: 5,
                name: "Escopo e Restrições de Investimento",
                format: "text",
                prompt: "Qual é a estratégia de investimento declarada, o escopo e quaisquer restrições do fundo? Inclua setores permitidos, geografias, estágios de investimento, tipos de instrumentos e quaisquer limites de concentração (ex. percentual máximo do capital comprometido por investimento único). Observe quanta discricionariedade o SA tem para se desviar da estratégia declarada.",
            },
            {
                index: 6,
                name: "Prazo do Fundo",
                format: "text",
                prompt: "Qual é o prazo do fundo? Informe o prazo inicial (ex. 10 anos a partir do fechamento final), quaisquer períodos de prorrogação permitidos (ex. 2 prorrogações de 1 ano), quem tem o direito de aprovar prorrogações (SA sozinho ou com consentimento de SC/CSL) e quaisquer mecanismos de rescisão antecipada.",
            },
            {
                index: 7,
                name: "Taxa de Gestão",
                format: "text",
                prompt: "Qual taxa de gestão é paga ao SA ou gestor? Informe a taxa, a base sobre a qual é calculada (ex. capital comprometido durante o período de investimento, depois valor investido ou valor patrimonial líquido), quaisquer reduções ao longo da vida do fundo e a frequência de pagamento.",
            },
            {
                index: 8,
                name: "Participação nos Lucros",
                format: "text",
                prompt: "Qual participação nos lucros (carry) é paga ao SA? Informe o percentual de carry, a estrutura (waterfall europeu/nível de fundo vs americano/por operação) e identifique cada etapa do waterfall de distribuição em sequência (ex. devolução de capital, retorno preferido, catch-up do SA, depois divisão de lucros).",
            },
            {
                index: 9,
                name: "Retorno Preferido (Taxa de Hurdle)",
                format: "percentage",
                prompt: "Há um retorno preferido ou taxa de hurdle que os SCs devem receber antes que o SA ganhe carry? Informe a taxa, se é composta (e em que base) e como é calculada (ex. sobre capital investido, sobre capital aportado). Se não houver retorno preferido, informe isso explicitamente.",
            },
            {
                index: 10,
                name: "Catch-Up do SA",
                format: "text",
                prompt: "Há um mecanismo de catch-up do SA após o retorno preferido ser atingido? Se sim, descreva como opera: qual percentual das distribuições vai ao SA durante o catch-up e qual resultado econômico o catch-up é projetado para alcançar (ex. o SA recebe 20% de todos os lucros até a data).",
            },
            {
                index: 11,
                name: "Clawback",
                format: "text",
                prompt: "Há uma obrigação de clawback sobre o SA se ele receber excesso de carry? Informe se o clawback é calculado a nível de fundo ou a nível de sócio individual, quando é acionado, qualquer limite ou teto na obrigação de clawback e se há algum acordo de escrow ou garantia para apoiar a obrigação de clawback do SA.",
            },
            {
                index: 12,
                name: "Taxas e Despesas (Além da Taxa de Gestão)",
                format: "bulleted_list",
                prompt: "Quais taxas e despesas são cobradas ao fundo ou aos SCs além da taxa de gestão? Liste cada categoria (ex. taxas de transação, taxas de monitoramento, custos de negócios frustrados, despesas de constituição, honorários jurídicos, custos de administração do fundo, despesas organizacionais). Para cada uma, informe quem arca com o custo e se quaisquer valores são compensados contra a taxa de gestão.",
            },
            {
                index: 13,
                name: "Distribuições",
                format: "text",
                prompt: "Como e quando as distribuições são feitas aos SCs? Descreva a cronologia das distribuições (ex. após realização de investimentos ou a critério do SA), se o SA pode reinvestir os recursos dentro do período de investimento e se as distribuições podem ser feitas em espécie (ou seja, como valores mobiliários em vez de dinheiro).",
            },
            {
                index: 14,
                name: "Cláusula de Pessoa-Chave",
                format: "text",
                prompt: "Há uma cláusula de pessoa-chave? Identifique as pessoas-chave designadas. O que aciona o evento de pessoa-chave (ex. saída, incapacidade, redução do tempo de dedicação abaixo de um limiar)? Quais são as consequências (ex. suspensão do período de investimento)? Os SCs têm algum direito de rescindir ou votar sobre continuação após um evento de pessoa-chave?",
            },
            {
                index: 15,
                name: "Remoção do SA",
                format: "text",
                prompt: "Em que circunstâncias o SA pode ser removido? Distinga entre remoção por justa causa (ex. fraude, negligência grave, dolo — informe o limiar de votação de SC exigido) e remoção sem justa causa (informe o limiar de votação de SC e quaisquer consequências associadas, como tratamento da participação nos lucros na remoção).",
            },
            {
                index: 16,
                name: "Comitê Consultivo (CSL)",
                format: "text",
                prompt: "Há um Comitê Consultivo de SCs (CSL) ou órgão de governança similar? Se sim, descreva sua composição, como os membros são selecionados, seus principais poderes e responsabilidades (ex. aprovar conflitos de interesse, avaliações, prorrogações, transações com partes relacionadas) e se sua aprovação é vinculante ou meramente consultiva.",
            },
            {
                index: 17,
                name: "Restrições à Transferência",
                format: "text",
                prompt: "Quais restrições se aplicam à transferência ou cessão do interesse de um SC no fundo? O consentimento do SA é necessário? Há quaisquer exceções de transferência permitida (ex. para afiliadas)? As vendas no mercado secundário são permitidas e, em caso afirmativo, sujeitas a quais condições ou direitos de preferência?",
            },
            {
                index: 18,
                name: "Conflitos de Interesse",
                format: "text",
                prompt: "Como o contrato trata conflitos de interesse? Descreva a política de alocação de negócios entre fundos, quaisquer direitos de co-investimento concedidos aos SCs, restrições a transações com partes relacionadas e o papel do CSL em revisar ou aprovar conflitos. Observe quaisquer cenários de conflito específicos expressamente contemplados.",
            },
            {
                index: 19,
                name: "Lei Aplicável",
                format: "text",
                prompt: "Qual lei aplicável rege este contrato e quais tribunais ou câmaras arbitrais têm jurisdição sobre as disputas?",
            },
        ],
    },

    // ─── Contrato de Acionistas (Assistente) ───────────────────────────────────────
    {
        id: "builtin-sha-summary-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Resumo de Contrato de Acionistas",
        type: "assistant",
        practice: "Societário",
        prompt_md:
            "## Resumo de Contrato de Acionistas\n\n" +
            "Analise o contrato de acionistas carregado e produza um resumo jurídico abrangente cobrindo os seguintes tópicos. " +
            "Para cada seção, identifique as principais disposições, cite as referências de cláusula relevantes e sinalize quaisquer desvios incomuns, onerosos ou do padrão de mercado.\n\n" +
            "1. **Partes e Participações** — Nomes completos, papéis, classes de ações detidas e percentuais de interesse (em base totalmente diluída, se informado)\n" +
            "2. **Classes de Ações e Direitos** — Para cada classe: direitos de voto, direitos a dividendos, preferência de liquidação, características de conversão ou resgate\n" +
            "3. **Composição do Conselho e Governança** — Tamanho do conselho, direitos de indicação de diretores (e os limiares de participação acionária necessários para mantê-los), quórum e voto de desempate\n" +
            "4. **Matérias Reservadas** — Decisões que exigem maioria especial, unanimidade ou consentimento de um acionista específico; observe o limiar e de quem é necessário o consentimento para cada uma\n" +
            "5. **Preemptiva sobre Novas Ações** — Quem detém direitos preemptivos, procedimento, cronograma e quaisquer exceções (ex. planos de opção de empregados)\n" +
            "6. **Restrições à Transferência** — Períodos de lock-up, transferências proibidas, transferências permitidas (ex. para afiliadas) e quaisquer requisitos de aprovação do conselho ou acionistas\n" +
            "7. **Direito de Preferência / Preemptiva na Transferência** — Gatilho, procedimento, mecânica de precificação e quaisquer exceções\n" +
            "8. **Direitos de Arrastamento** — Quem detém o direito, limiar para acionar, condições (ex. preço mínimo, avaliação independente) e proteções às minoritárias\n" +
            "9. **Direitos de Acompanhamento** — Quem detém o direito, limiar de gatilho, procedimento de exercício e termos de preço\n" +
            "10. **Proteções Antidiluição** — Tipo (full ratchet, média ponderada), eventos de gatilho, mecânica de cálculo e exceções\n" +
            "11. **Política de Dividendos** — Qualquer obrigação ou meta de pagamento de dividendos, direitos preferenciais a dividendos e restrições às distribuições\n" +
            "12. **Saída e Liquidez** — Rotas de saída acordadas (venda de ativos, IPO, venda por arrastamento), cronogramas e preferências de liquidação na saída\n" +
            "13. **Deadlock** — Definição de deadlock, mecanismos de escalada e resolução (ex. roleta russa, opções de put/call) e consequências se não resolvido\n" +
            "14. **Não Concorrência e Não Solicitação** — Quem está vinculado, escopo de atividades e geografia, duração e exceções\n" +
            "15. **Lei Aplicável e Resolução de Disputas** — Lei aplicável, fórum, arbitragem ou litígio e quaisquer etapas de escalada obrigatórias\n\n" +
            "Gere o resumo como um documento Word para download.",
        columns_config: null,
    },

    // ─── Contrato de Acionistas ────────────────────────────────────────────────────
    {
        id: "builtin-shareholder-agreement-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de Contrato de Acionistas",
        type: "tabular",
        practice: "Societário",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Partes",
                format: "bulleted_list",
                prompt: "Identifique todas as partes deste contrato de acionistas. Para cada uma, informe sua razão social completa, jurisdição de constituição ou estabelecimento (se declarada) e seu papel (ex. empresa, acionista majoritário, acionista minoritário, investidor, fundador, acionista de gestão).",
            },
            {
                index: 1,
                name: "Data",
                format: "date",
                prompt: "Qual é a data deste contrato de acionistas?",
            },
            {
                index: 2,
                name: "Capital Social e Classes",
                format: "bulleted_list",
                prompt: "Quais classes de ações estão em circulação ou contempladas por este contrato? Para cada classe, descreva os principais direitos a ela atrelados, incluindo direitos de voto, direitos a dividendos, preferência de liquidação (se houver) e quaisquer características de conversão ou resgate.",
            },
            {
                index: 3,
                name: "Participações Acionárias",
                format: "bulleted_list",
                prompt: "Quais são as participações acionárias de cada parte conforme estabelecido ou contemplado neste contrato? Para cada acionista, informe o número de ações detidas, a classe e o percentual do capital social total (em base totalmente diluída, se informado).",
            },
            {
                index: 4,
                name: "Composição do Conselho",
                format: "text",
                prompt: "Como o conselho de administração é constituído sob este contrato? Informe o número total de diretores, o direito de cada acionista ou classe de acionistas de indicar ou nomear diretores (e o limiar de participação acionária necessário para manter esse direito) e quaisquer disposições para um presidente ou voto de desempate.",
            },
            {
                index: 5,
                name: "Matérias Reservadas",
                format: "bulleted_list",
                prompt: "Quais são as matérias reservadas ou direitos de veto estabelecidos neste contrato? Liste cada matéria que exige aprovação acionária ou de diretor além de maioria ordinária (ex. maioria especial, unanimidade ou consentimento de um acionista específico). Identifique o limiar aplicável ou de quem é necessário o consentimento para cada uma.",
            },
            {
                index: 6,
                name: "Preemptiva sobre Novas Ações",
                format: "text",
                prompt: "Quais direitos preemptivos se aplicam à emissão de novas ações? Descreva quem detém direitos preemptivos, o procedimento para oferecer novas ações aos acionistas existentes, o cronograma para aceitação e quaisquer exceções ou exclusões (ex. ações emitidas sob um plano de opção de empregados, emissões permitidas).",
            },
            {
                index: 7,
                name: "Restrições à Transferência",
                format: "text",
                prompt: "Quais restrições se aplicam à transferência de ações? Identifique quaisquer períodos de lock-up (e sua duração), quais transferências são proibidas integralmente e quais transferências são permitidas sem consentimento (ex. para afiliadas ou trusts familiares). Observe quaisquer requisitos de aprovação do conselho ou acionistas para transferências.",
            },
            {
                index: 8,
                name: "Direito de Preferência / Preemptiva na Transferência",
                format: "text",
                prompt: "Há um direito de preferência ou direito preemptivo sobre uma transferência proposta de ações? Se sim, descreva quem detém o direito, o procedimento para acionar e exercê-lo (incluindo prazos de notificação e mecânica de precificação) e quaisquer exceções.",
            },
            {
                index: 9,
                name: "Direitos de Arrastamento",
                format: "text",
                prompt: "Há direitos de arrastamento? Se sim, identifique quem detém o direito de arrastamento (ex. acionistas majoritários acima de um limiar especificado), o limiar necessário para acionar um arrastamento, as obrigações impostas aos acionistas arrastados, quaisquer condições ao arrastamento (ex. preço mínimo, avaliação independente) e quaisquer proteções aos acionistas minoritários.",
            },
            {
                index: 10,
                name: "Direitos de Acompanhamento",
                format: "text",
                prompt: "Há direitos de acompanhamento? Se sim, identifique quem detém o direito de acompanhamento, o limiar de transferência que aciona o acompanhamento, o procedimento para exercer o acompanhamento (incluindo prazos de notificação), o preço e termos nos quais o acionista acompanhante pode vender e quaisquer exceções.",
            },
            {
                index: 11,
                name: "Proteções Antidiluição",
                format: "text",
                prompt: "Há quaisquer proteções antidiluição para qualquer classe de acionistas? Se sim, descreva o tipo de proteção (ex. full ratchet, média ponderada, de base ampla ou estreita), os eventos de gatilho, como o preço ajustado ou direito é calculado e quaisquer exceções (ex. emissões permitidas excluídas do cálculo).",
            },
            {
                index: 12,
                name: "Política de Dividendos",
                format: "text",
                prompt: "Quais disposições de dividendos estão estabelecidas neste contrato? Descreva qualquer obrigação ou política de pagamento de dividendos (ex. percentual mínimo dos lucros distribuíveis), quaisquer direitos preferenciais a dividendos atrelados a uma classe específica de ações e quaisquer restrições aos pagamentos de dividendos (ex. sujeitos a lucros disponíveis, aprovação do conselho ou acionistas, consentimento do credor).",
            },
            {
                index: 13,
                name: "Disposições de Saída e Liquidez",
                format: "text",
                prompt: "Quais disposições de saída ou liquidez estão incluídas? Descreva quaisquer mecanismos de saída acordados (ex. venda de ativos, IPO, venda por arrastamento), quaisquer cronogramas ou marcos pelos quais uma saída é almejada, quaisquer direitos de acionistas de iniciar ou compelir um processo de saída após um período especificado e qualquer preferência nos recursos de saída atrelada a uma classe específica de ações.",
            },
            {
                index: 14,
                name: "Deadlock",
                format: "text",
                prompt: "Como o deadlock é tratado? Descreva quaisquer mecanismos de resolução de deadlock (ex. escalada para alta gerência, mediação, disposições de roleta russa / shoot-out, opções de put/call). Para cada mecanismo, informe as condições de gatilho, o procedimento e as consequências se o deadlock não for resolvido.",
            },
            {
                index: 15,
                name: "Não Concorrência e Não Solicitação",
                format: "text",
                prompt: "Algum acionista está sujeito a obrigações de não concorrência ou não solicitação? Se sim, identifique quais acionistas estão vinculados, o escopo da restrição (atividades e geografia) e a duração (durante o prazo do contrato e/ou por um período após um acionista deixar de deter ações). Observe quaisquer exceções.",
            },
            {
                index: 16,
                name: "Confidencialidade",
                format: "text",
                prompt: "Quais obrigações de confidencialidade são impostas aos acionistas? Informe o escopo das informações confidenciais cobertas, as divulgações permitidas (ex. a consultores profissionais, afiliadas, credores) e a duração da obrigação. Observe se a obrigação sobrevive à rescisão do contrato.",
            },
            {
                index: 17,
                name: "Garantias",
                format: "text",
                prompt: "Quais garantias são dadas pelos acionistas sob este contrato? Identifique quem dá as garantias, a matéria (ex. titularidade das ações, capacidade, ônus, conflitos), quaisquer limitações às reclamações de garantia (ex. prazos, limites, qualificações de conhecimento) e quaisquer indenizações dadas junto com as garantias.",
            },
            {
                index: 18,
                name: "Lei Aplicável",
                format: "text",
                prompt: "Qual lei aplicável rege este contrato? Informe a jurisdição e qualquer sistema jurídico específico referenciado.",
            },
            {
                index: 19,
                name: "Resolução de Disputas",
                format: "text",
                prompt: "Como as disputas são resolvidas sob este contrato? Identifique se as disputas vão para litígio ou arbitragem, o fórum ou sede escolhido, quaisquer etapas de escalada obrigatórias e se a jurisdição é exclusiva.",
            },
        ],
    },

    // ─── Contrato de Trabalho ─────────────────────────────────────────────────────
    {
        id: "builtin-employment-agreement-ptbr",
        user_id: null,
        is_system: true,
        created_at: "",
        title: "Revisão de Contrato de Trabalho",
        type: "tabular",
        practice: "Trabalhista",
        prompt_md: null,
        columns_config: [
            {
                index: 0,
                name: "Empregador",
                format: "text",
                prompt: "Quem é o empregador sob este contrato? Informe a razão social completa e jurisdição de constituição ou estabelecimento.",
            },
            {
                index: 1,
                name: "Empregado",
                format: "text",
                prompt: "Quem é o empregado sob este contrato? Informe seu nome completo e, se fornecido, seu endereço ou localização.",
            },
            {
                index: 2,
                name: "Data",
                format: "date",
                prompt: "Qual é a data deste contrato de trabalho? Se uma data de início ou admissão diferir da data de assinatura, informe ambas.",
            },
            {
                index: 3,
                name: "Cargo",
                format: "text",
                prompt: "Qual é o cargo ou posição do empregado conforme declarado neste contrato? Se uma linha de reporte for especificada, inclua-a.",
            },
            {
                index: 4,
                name: "Remuneração",
                format: "text",
                prompt: "Qual é a remuneração do empregado sob este contrato? Informe o salário base ou vencimento, a moeda e a frequência de pagamento (ex. mensal, quinzenal). Inclua qualquer bônus garantido, comissão ou outros elementos fixos de remuneração.",
            },
            {
                index: 5,
                name: "Tempo Integral / Meio Período",
                format: "tag",
                tags: ["Tempo Integral", "Meio Período"],
                prompt: "Esta é uma posição de tempo integral ou meio período? Se meio período, informe o número de dias ou horas por semana onde especificado.",
            },
            {
                index: 6,
                name: "Contratado Independente?",
                format: "yes_no",
                prompt: "O contrato caracteriza o trabalhador como contratado independente em vez de empregado? Responda Sim se o contrato usar linguagem de contratado, consultor ou autônomo. Observe quaisquer disposições que abordem a natureza da relação.",
            },
            {
                index: 7,
                name: "Benefícios",
                format: "bulleted_list",
                prompt: "A quais benefícios o empregado tem direito sob este contrato? Liste cada benefício (ex. plano de saúde, contribuições previdenciárias, seguro de vida, auxílio-transporte, opções de ações, reembolso de despesas). Observe quaisquer condições de elegibilidade ou limites.",
            },
            {
                index: 8,
                name: "Prazo de Aviso Prévio (Empregador para Empregado)",
                format: "text",
                prompt: "Qual aviso o empregador deve dar para rescindir o emprego do empregado (exceto por justa causa)? Informe o prazo de aviso prévio e quaisquer disposições para pagamento em substituição ao aviso prévio.",
            },
            {
                index: 9,
                name: "Prazo de Aviso Prévio (Empregado para Empregador)",
                format: "text",
                prompt: "Qual aviso o empregado deve dar para pedir demissão? Informe o prazo de aviso prévio e quaisquer disposições para pagamento em substituição ao aviso prévio ou licença remunerada.",
            },
            {
                index: 10,
                name: "Horas Extras",
                format: "text",
                prompt: "Quais disposições se aplicam a horas extras? O empregado tem direito a pagamento de horas extras e, em caso afirmativo, em que taxa? Ou o contrato estabelece que o salário já inclui quaisquer horas extras? Observe qualquer renúncia a limites estatutários de jornada de trabalho.",
            },
            {
                index: 11,
                name: "Jornada de Trabalho",
                format: "text",
                prompt: "Quais horários de trabalho são especificados neste contrato? Informe as horas normais de trabalho, quaisquer disposições de flexibilidade e se o empregado é esperado a trabalhar horas adicionais conforme necessário.",
            },
            {
                index: 12,
                name: "Alteração",
                format: "text",
                prompt: "Quais disposições regem a alteração dos termos deste contrato? O empregador pode alterar termos unilateralmente, ou é necessário o consentimento do empregado? Observe quaisquer termos específicos que são declarados como variáveis sem consentimento.",
            },
            {
                index: 13,
                name: "Cessão de Propriedade Intelectual",
                format: "text",
                prompt: "Quais disposições de cessão de propriedade intelectual estão incluídas? O empregado cede ao empregador toda a PI criada no curso do emprego? Há quaisquer exceções para PI pré-existente ou invenções criadas fora do horário de trabalho? Observe qualquer renúncia a direitos morais.",
            },
            {
                index: 14,
                name: "Motivos para Rescisão",
                format: "bulleted_list",
                prompt: "Quais motivos para dispensa imediata ou rescisão por justa causa estão estabelecidos no contrato? Liste cada motivo (ex. falta grave, violação de confidencialidade, insolvência, condenação criminal). Observe se a dispensa imediata é sem aviso prévio ou pagamento em substituição.",
            },
            {
                index: 15,
                name: "Direito a Férias Anuais",
                format: "text",
                prompt: "Qual é o direito a férias anuais do empregado? Informe o número de dias (ou semanas) por ano, se isso é inclusivo ou adicional aos feriados públicos e quaisquer disposições sobre acúmulo, acumulação ou pagamento de férias não gozadas na rescisão.",
            },
        ],
    },
];

export const BUILT_IN_IDS_PTBR = new Set(BUILT_IN_WORKFLOWS_PTBR.map((wf) => wf.id));
