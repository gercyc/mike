export const BUILTIN_WORKFLOWS_PTBR: { id: string; title: string; prompt_md: string }[] = [
    {
        id: "builtin-cp-checklist-ptbr",
        title: "Gerar Checklist de CP",
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
            "Use o campo table no objeto da seção (não content) para as linhas de cada categoria.\n\n" +
            "Antes de finalizar, verifique novamente que toda tabela está formatada corretamente: cada tabela deve ter exatamente as quatro colunas acima na mesma ordem, os cabeçalhos devem corresponder exatamente (Índice, Número da Cláusula, Cláusula, Status), cada linha deve ter o mesmo número de células que os cabeçalhos, a coluna Índice deve ser sequencial começando de 1 dentro de cada categoria, e nenhuma célula deve conter markdown solto, quebras de linha ou texto de placeholder (use uma string vazia para Status).",
    },
    {
        id: "builtin-credit-summary-ptbr",
        title: "Resumo de Contrato de Crédito",
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
    },
    {
        id: "builtin-sha-summary-ptbr",
        title: "Resumo de Contrato de Acionistas",
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
    },
];
