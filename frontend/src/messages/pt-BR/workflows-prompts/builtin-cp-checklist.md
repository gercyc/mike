## Gerar Checklist de Condições Precedentes (CP)

Analise o contrato de crédito ou documento de financiamento carregado e gere uma checklist abrangente de Condições Precedentes (CP).

Você DEVE usar a ferramenta generate_docx para produzir a checklist como um documento Word para download. Você DEVE passar landscape: true para a ferramenta generate_docx — o documento deve estar em orientação paisagem. Não exiba a checklist inline — gere o arquivo .docx e forneça o link de download.

Estruture o documento da seguinte forma:
- Para cada categoria de condições (ex. Societária, Financeira, Jurídica, Garantias), adicione uma seção com um título
- Sob cada título de categoria, inclua uma tabela com exatamente estas quatro colunas nesta ordem:
  1. Índice — número sequencial dentro da categoria (1, 2, 3…)
  2. Número da Cláusula — a referência da cláusula ou anexo do contrato
  3. Cláusula — uma descrição concisa da condição precedente
  4. Status — deixe em branco (string vazia) para o usuário preencher

Use o campo table no objeto da seção (não content) para as linhas de cada categoria.
