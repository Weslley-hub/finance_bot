# Comandos do Finlar

O bot só responde no **grupo autorizado** da família. O objetivo é quase nunca precisar de comando — dá para escrever como fala.

## Início e ajuda


| Comando          | O que faz                               |
| ---------------- | --------------------------------------- |
| `/start`         | Inicia o bot e explica o próximo passo |
| `/ajuda`         | Mostra a ajuda completa                 |
| `/help`          | Igual a`/ajuda`                         |
| `/ping`          | Responde`pong` (teste de conexão)      |
| `/subcategorias` | Lista categorias e subcategorias        |

## Configuração da família


| Comando          | O que faz                                         |
| ---------------- | ------------------------------------------------- |
| `/configuracoes` | Vincula o grupo à família e abre as permissões |
| `/configurar`    | Alias de`/configuracoes`                          |

Depois use os botões: adicionar membros, todos, só admins ou membros selecionados.

## Relatórios


| Comando       | O que faz                                        | Exemplos                                                                |
| ------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `/resumo`     | Resumo do mês (receitas, despesas, saldo)       | `/resumo`                                                               |
| `/extrato`    | Histórico de lançamentos                       | `/extrato` · `/extrato hoje` · `/extrato semana` · `/extrato agosto` |
| `/categorias` | Gastos do mês por categoria                     | `/categorias`                                                           |
| `/contas`     | Contas do mês                                   | `/contas`                                                               |
| `/fatura`     | O que ainda falta pagar                          | `/fatura`                                                               |
| `/previsao`   | Como o mês deve terminar                        | `/previsao`                                                             |
| `/auditoria`  | Quem criou, alterou ou arquivou cada lançamento | `/auditoria`                                                            |

## Lançamentos


| Comando          | O que faz                                       | Exemplos                                    |
| ---------------- | ----------------------------------------------- | ------------------------------------------- |
| `/receita`       | Registrar receita                               | `/receita 5000 salario`                     |
| `/despesa`       | Registrar despesa                               | `/despesa 350 mercado`                      |
| `/transferencia` | Registrar transferência entre contas           | `/transferencia 500 do nubank para o inter` |
| `/editar`        | Corrigir o último lançamento                  | `/editar`                                   |
| `/desfazer`      | Arquivar o último registro (não apaga de vez) | `/desfazer`                                 |

## Cartões, orçamento e metas


| Comando        | O que faz                                  | Exemplos                                               |
| -------------- | ------------------------------------------ | ------------------------------------------------------ |
| `/cartoes`     | Lista cartões e fatura                    | `/cartoes`                                             |
| `/cartao`      | Alias de `/cartoes`, cadastra ou apaga | `/cartao Nubank limite 5000 fecha dia 22 vence dia 29` · `/cartao apagar Santander` |
| `/limites`     | Limite usado e disponível em cada cartão | `/limites` · `/limite Santander` · `/limite Santander usado 4500` |
| `/orcamento`   | Lista limites por categoria, ou define um | `/orcamento` · `/orcamento mercado 1200` · `/limite mercado 1200` |
| `/metas`       | Mostra a meta do mês, ou define           | `/metas` · `/metas 2000`                              |
| `/meta`        | Alias de`/metas`                           | `/meta 2000`                                           |
| `/recorrentes` | Lista o cadastro mensal e meses em aberto | `/recorrentes` · `/recorrentes Terreno 289 todo dia 10` |

## Sem comando (texto natural)

### Registrar

```
gastei 45 no almoço
mercado 350
recebi meu salário 5500
entrou 1200 de freelance
minha esposa recebeu 3500
gastei 120 no Nubank
```

### Recorrente, parcela e cartão

```
 todo dia 10 pago 292,80 do terreno
Netflix 55,90 todo dia 7
comprei uma TV de 2400 em 10x no Nubank
cartão Nubank limite 5000 fecha dia 22 vence dia 29
apaga o cartão Santander
cartão Santander - limite usado 4500
```

### Orçamento e meta

```
orçamento mercado 1200
queremos guardar 2000 por mês
```

### Consultar

```
como estão nossas finanças?
quanto gastamos com mercado?
quanto eu gastei?
quanto nós gastamos?
quanto minha esposa gastou?
onde estamos gastando mais?
gastamos mais do que mês passado?
quanto ainda temos para pagar?
como devemos terminar o mês?
extrato hoje
mostra todas as compras do Nubank
mostra gastos maiores que 500
procura a compra da Amazon
o que gastamos sexta?
```

### Corrigir o último lançamento

```
na verdade foram 46 reais
coloca como restaurante
coloca isso em Educação
foi no Nubank
```

## Foto e PDF

Envie no grupo:

- foto ou PDF de comprovante (PIX, TED, boleto)
- fatura de cartão em PDF (`fatura-nubank-agosto.pdf`)
- conta (energia, água, internet)

PIX/TED entre bancos (Nubank → Inter) vira **transferência**, não despesa.

Depois dá para confirmar no card ou escrever: `paguei a energia`.

## Lista para o BotFather (`/setcommands`)

```
start - Iniciar o bot
ajuda - Ajuda e exemplos
resumo - Resumo do mês
extrato - Histórico de lançamentos
contas - Contas do mês
categorias - Gastos por categoria
receita - Registrar receita
despesa - Registrar despesa
transferencia - Registrar transferência
cartoes - Cartões e fatura
limites - Limite usado e disponível nos cartões
fatura - O que ainda temos para pagar
previsao - Previsão do mês
orcamento - Limites por categoria
metas - Meta de guardar no mês
recorrentes - Contas que se repetem
editar - Corrigir o último lançamento
desfazer - Arquivar o último registro
auditoria - Quem alterou o quê
configuracoes - Vincular o grupo à família
subcategorias - Lista de categorias
ping - Testar se o bot está no ar
```
