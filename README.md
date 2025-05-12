 # Quiz Game - Servidor Socket.io: Guia de Integração e API

## 📌 Visão Geral

Este documento descreve o servidor de perguntas e respostas (quiz) implementado com **Node.js** e **Socket.io**. O sistema permite que múltiplos clientes se conectem de forma simultânea para participar de jogos de quiz. O servidor é responsável por gerenciar todo o ciclo de vida do jogo, incluindo a seleção de categorias, o fornecimento de perguntas, a validação de respostas e o cálculo da pontuação dos jogadores. As perguntas utilizadas no quiz são obtidas dinamicamente através da API pública **OpenTDB (Open Trivia Database - `https://opentdb.com`)**. O design do servidor facilita sua integração em diversas aplicações, sendo compatível com ambientes que utilizam frameworks como Next.js, conforme demonstrado pela estrutura do código-fonte de referência.

## 🌐 Protocolo de Comunicação

A interação entre o cliente e o servidor ocorre por meio de eventos Socket.io. O servidor emite eventos para transmitir informações e o estado do jogo ao cliente, enquanto o cliente emite eventos para interagir com as funcionalidades do quiz.

### 📡 Eventos do Servidor para Cliente

A tabela a seguir detalha os eventos que o servidor envia para o cliente:

| Evento                  | Descrição                                                                                                                               | Estrutura de Dados (Payload)                                                     |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| `temas_disponiveis`     | Enviado ao cliente logo após uma conexão bem-sucedida. Contém a lista de todas as categorias de perguntas disponíveis para o quiz.        | `Array<{id: number, nome: string}>`                                               |
| `configuracao_inicial`  | Emitido depois que o cliente seleciona um tema. Informa ao cliente o número total de perguntas que compõem o quiz para o tema escolhido. | `{totalPerguntas: number}`                                                        |
| `pergunta`              | Transmite a próxima pergunta do quiz para o jogador. Inclui o ID da pergunta, seu texto, as alternativas e o índice da resposta correta. | `{id: string, texto: string, alternativas: string[], correta: number}`           |
| `resultado`             | Fornece o feedback da resposta enviada pelo jogador. Indica se a resposta foi correta, qual era a alternativa correta e a pontuação atual. | `{correta: boolean, respostaCorreta: number, pontuacao: number}`                 |
| `fim`                   | Sinaliza que todas as perguntas do tema selecionado foram respondidas. Conclui o jogo e apresenta a pontuação final do jogador.             | `{pontuacao: number, totalPerguntas: number}`                                    |
| `error`                 | Notifica o cliente sobre a ocorrência de erros durante a interação com o servidor.                                                      | `string` (Exemplos de mensagens: `"Falha ao carregar perguntas. Tente novamente."`, `"Estado do jogo inválido."`, `"Índice de resposta inválido."`, `"Jogador não encontrado."`). |

### 📤 Eventos do Cliente para Servidor

A tabela a seguir detalha os eventos que o cliente envia para o servidor:

| Evento                | Descrição                                                                                                   | Estrutura de Dados (Payload)       |
|-----------------------|-------------------------------------------------------------------------------------------------------------|-------------------------------------|
| `selecionar_tema`     | Emitido pelo cliente para escolher uma categoria de perguntas e, consequentemente, iniciar uma nova partida do quiz. | `number` (ID da categoria)         |
| `resposta`            | Submete a alternativa selecionada pelo jogador como resposta para a pergunta atualmente exibida.              | `number` (Índice da alternativa, 0-3) |
| `proxima_pergunta`    | Solicita ao servidor a próxima pergunta do quiz. Se não houver mais perguntas, este evento pode levar à finalização do jogo. | `void`                             |

## 📋 Especificação da API Socket.io

### 1. Inicialização da Conexão

*   **Endpoint Padrão:** `/api/socket`. Este é o `path` configurado no servidor Socket.io. O URL base para a conexão dependerá do ambiente de hospedagem do servidor.
*   **Protocolo:** WebSocket (gerenciado pela biblioteca Socket.io).
*   **Autenticação:** A conexão inicial via Socket.io não requer autenticação.

### 2. Fluxo do Jogo Detalhado

O desenvolvimento de um jogo de quiz segue as etapas descritas abaixo:

1.  **Conexão Inicial e Recepção de Temas:**
    *   O cliente estabelece uma conexão com o servidor Socket.io utilizando o endpoint e o `path` especificados.
    *   Após a conexão ser estabelecida com sucesso, o servidor envia imediatamente o evento `temas_disponiveis`. Este payload contém uma lista das categorias de perguntas disponíveis.

2.  **Seleção de Tema pelo Jogador:**
    *   O cliente apresenta os temas recebidos ao jogador.
    *   Quando o jogador escolhe um tema, o cliente emite o evento `selecionar_tema`, enviando o `id` numérico da categoria selecionada para o servidor.
    *   Se o `id` da categoria for inválido ou se ocorrer um erro durante a busca das perguntas (por exemplo, uma falha na comunicação com a API OpenTDB), o servidor responderá com um evento `error`, contendo uma mensagem descritiva.
    *   Caso a seleção seja válida, o servidor buscará as perguntas para o tema (utilizando um cache interno para otimizar requisições subsequentes para a mesma categoria). Em seguida, o servidor emite o evento `configuracao_inicial`, que informa o número total de perguntas para o quiz daquele tema.

3.  **Rodada de Perguntas e Respostas:**
    *   O servidor envia a primeira pergunta ao cliente através do evento `pergunta`. O payload deste evento inclui um ID único para a pergunta (gerado dinamicamente pelo servidor), o texto da pergunta (já decodificado e pronto para exibição), uma lista de alternativas de resposta (embaralhadas pelo servidor) e o índice da alternativa correta (este último é para referência do servidor e não deve ser usado pelo cliente para revelar a resposta prematuramente).
    *   O cliente exibe a pergunta e as alternativas ao jogador.
    *   O jogador seleciona uma alternativa. O cliente, então, emite o evento `resposta`, enviando o índice da alternativa escolhida pelo jogador.
    *   O servidor valida a resposta. Se o índice fornecido for inválido (por exemplo, fora do intervalo de alternativas disponíveis), o servidor emitirá um evento `error`.
    *   Se a resposta for válida, o servidor a compara com a alternativa correta, atualiza a pontuação do jogador e emite o evento `resultado`. Este evento informa se a resposta do jogador foi correta, qual era o índice da resposta correta e a pontuação acumulada do jogador.
    *   O cliente exibe o resultado da rodada ao jogador.
    *   Em seguida, o cliente emite o evento `proxima_pergunta` para solicitar a próxima questão.
    *   Este ciclo (servidor envia `pergunta`, cliente envia `resposta`, servidor envia `resultado`, cliente envia `proxima_pergunta`) se repete até que todas as perguntas do tema selecionado tenham sido apresentadas.

4.  **Fim do Jogo:**
    *   Quando o cliente emite o evento `proxima_pergunta` e o servidor constata que não há mais perguntas restantes para o tema atual, o servidor emite o evento `fim`.
    *   O payload do evento `fim` contém a pontuação final do jogador e o número total de perguntas que foram feitas. Isso permite ao cliente exibir uma tela de resumo do jogo.
    *   A conexão Socket.io pode ser mantida, possibilitando ao jogador iniciar um novo jogo selecionando outro tema, ou pode ser encerrada pelo cliente.

### 3. Estruturas de Dados Detalhadas

As interfaces TypeScript a seguir descrevem as estruturas de dados utilizadas nos payloads dos eventos Socket.io:

#### Estrutura da Pergunta (Payload do evento `pergunta`):
```typescript
interface Pergunta {
  id: string;            // ID único da pergunta, gerado dinamicamente pelo servidor.
  texto: string;         // Texto da pergunta (decodificado de URL encoding RFC 3986, pronto para exibição).
  alternativas: string[]; // Array de strings contendo as alternativas (normalmente 4), já embaralhadas pelo servidor.
  correta: number;       // Índice (0-3) da alternativa correta dentro do array 'alternativas'.
}
```

#### Estrutura do Resultado da Resposta (Payload do evento `resultado`):
```typescript
interface ResultadoResposta {
  correta: boolean;      // true se a resposta do jogador estava correta, false caso contrário.
  respostaCorreta: number; // Índice da alternativa que era a correta.
  pontuacao: number;     // Pontuação acumulada do jogador após esta resposta.
}
```

#### Estrutura das Categorias Disponíveis (Payload do evento `temas_disponiveis`):
```typescript
interface Categoria {
  id: number;            // ID numérico da categoria, usado pelo cliente no evento 'selecionar_tema'.
  nome: string;          // Nome amigável da categoria para exibição ao jogador (ex: "Computação", "Esportes").
}
```

#### Estrutura da Configuração Inicial (Payload do evento `configuracao_inicial`):
```typescript
interface ConfiguracaoInicial {
  totalPerguntas: number; // Número total de perguntas que serão feitas no quiz para o tema selecionado.
}
```

#### Estrutura do Fim do Jogo (Payload do evento `fim`):
```typescript
interface FimJogo {
  pontuacao: number;        // Pontuação final obtida pelo jogador no quiz.
  totalPerguntas: number; // Número total de perguntas que foram apresentadas no quiz.
}
```

## 🛠️ Como Implementar um Cliente Compatível

Para desenvolver um cliente que interaja com este servidor de quiz, siga as diretrizes abaixo:

1.  **Conexão com o Servidor Socket.io:**
    *   Utilize uma biblioteca cliente Socket.io apropriada para a sua plataforma (por exemplo, `socket.io-client` para JavaScript/TypeScript).
    *   Estabeleça a conexão com o URL base do seu servidor, especificando o `path` correto para o namespace do Socket.io. Exemplo:
        ```javascript
        import { io } from "socket.io-client";

        // Substitua "SEU_SERVIDOR_URL" pelo endereço onde seu servidor está hospedado.
        // Exemplo para um servidor local na porta 3000:
        // const socket = io("http://localhost:3000", { path: "/api/socket" });
        const socket = io("SEU_SERVIDOR_URL", { path: "/api/socket" });
        ```

2.  **Manipulação de Eventos do Servidor:**
    *   Implemente funções de callback (handlers ou listeners) para cada um dos eventos que o servidor pode emitir (consulte a seção "Eventos do Servidor para Cliente"):
        *   `temas_disponiveis`: Para receber e apresentar a lista de categorias de quiz ao jogador.
        *   `configuracao_inicial`: Para obter o número total de perguntas do quiz selecionado.
        *   `pergunta`: Para receber os dados de cada pergunta e exibi-los ao jogador.
        *   `resultado`: Para informar ao jogador o resultado da sua resposta e sua pontuação atualizada.
        *   `fim`: Para apresentar a tela de final de jogo com a pontuação total.
        *   `error`: Para tratar e exibir mensagens de erro provenientes do servidor.

3.  **Emissão de Eventos do Cliente:**
    *   Desenvolva a lógica para emitir os eventos necessários para interagir com o jogo, conforme descrito na seção "Eventos do Cliente para Servidor":
        *   `selecionar_tema`: Quando o jogador escolhe uma categoria para iniciar o quiz.
        *   `resposta`: Quando o jogador submete a alternativa escolhida para uma pergunta.
        *   `proxima_pergunta`: Após o jogador visualizar o resultado de uma rodada, para solicitar a próxima pergunta.

### Exemplo Mínimo de Cliente (JavaScript com `socket.io-client`):

```javascript
import { io } from "socket.io-client";

// Ajuste o URL e o path conforme a configuração do seu servidor
const socket = io("http://localhost:3000", { path: "/api/socket" });

let totalPerguntasQuiz = 0;
let perguntasRespondidas = 0;

socket.on("connect", () => {
  console.log("Conectado ao servidor de Quiz! ID da conexão:", socket.id);
});

socket.on("temas_disponiveis", (categorias) => {
  console.log("Categorias (Temas) disponíveis:", categorias);
  // Implemente a lógica para exibir as categorias e permitir a seleção pelo usuário.
  // Exemplo: se o usuário escolher a primeira categoria da lista:
  if (categorias && categorias.length > 0) {
    const temaEscolhidoId = categorias[0].id;
    console.log(`Selecionando o tema: ${categorias[0].nome} (ID: ${temaEscolhidoId})`);
    socket.emit("selecionar_tema", temaEscolhidoId);
  }
});

socket.on("configuracao_inicial", (data) => {
  console.log("Configuração inicial do quiz recebida:", data);
  totalPerguntasQuiz = data.totalPerguntas;
  perguntasRespondidas = 0;
  // O servidor enviará a primeira pergunta automaticamente após este evento.
});

socket.on("pergunta", (pergunta) => {
  console.log("Nova pergunta recebida (ID:", pergunta.id, "):");
  console.log("Texto da pergunta:", pergunta.texto);
  console.log("Alternativas:", pergunta.alternativas);
  // Implemente a lógica para exibir a pergunta e as alternativas ao usuário.
  // Exemplo simulado: o usuário responde selecionando a primeira alternativa (índice 0).
  const respostaDoUsuario = 0; 
  console.log(`Enviando resposta: alternativa de índice ${respostaDoUsuario}`);
  socket.emit("resposta", respostaDoUsuario);
});

socket.on("resultado", (data) => {
  console.log("Resultado da resposta recebido:", data);
  if (data.correta) {
    console.log("Sua resposta está CORRETA!");
  } else {
    console.log(`Sua resposta está INCORRETA. A alternativa correta era a de índice: ${data.respostaCorreta}`);
  }
  console.log(`Sua pontuação atual: ${data.pontuacao}`);
  perguntasRespondidas++;

  // Solicitar a próxima pergunta ou finalizar o jogo.
  if (perguntasRespondidas < totalPerguntasQuiz) {
    console.log("Solicitando a próxima pergunta...");
    socket.emit("proxima_pergunta");
  } else {
    console.log("Todas as perguntas foram respondidas. O evento 'fim' deverá ser emitido pelo servidor.");
    // No fluxo atual, é necessário emitir 'proxima_pergunta' para que o servidor verifique se o jogo terminou e envie 'fim'.
    socket.emit("proxima_pergunta"); 
  }
});

socket.on("fim", (data) => {
  console.log("FIM DO JOGO!");
  console.log(`Sua pontuação final: ${data.pontuacao} de ${data.totalPerguntas} perguntas.`);
  // Implemente a lógica para exibir a tela de fim de jogo e oferecer opções (ex: jogar novamente).
});

socket.on("error", (mensagemErro) => {
  console.error("Erro recebido do servidor:", mensagemErro);
  // Implemente a lógica para exibir a mensagem de erro ao usuário de forma apropriada.
});

socket.on("disconnect", (reason) => {
  console.log("Desconectado do servidor de Quiz. Motivo:", reason);
});

// Exemplo de função que poderia ser chamada por um elemento da UI para selecionar um tema:
// function selecionarTema(temaId) {
//   socket.emit("selecionar_tema", temaId);
// }
```

### Exemplo Mínimo de Cliente (Python com `socket.io`):

```Python
import socketio

sio = socketio.Client()

def solicitar_resposta(alternativas):
    print("\nEscolha uma resposta:")
    for idx, alt in enumerate(alternativas):
        print(f"[{idx}] {alt}")
    
    while True:
        try:
            resposta = int(input("Digite o número da alternativa (0-3): "))
            if 0 <= resposta <= 3:
                return resposta
            print("Por favor, digite um número entre 0 e 3")
        except ValueError:
            print("Entrada inválida. Digite um número.")

@sio.event
def connect():
    print("✅ Conectado ao servidor!")
    sio.emit("selecionar_tema", 9)  # ID da categoria

@sio.on("pergunta")
def on_question(data):
    print("\n📝 Pergunta:")
    print(data["texto"])
    resposta = solicitar_resposta(data["alternativas"])
    sio.emit("resposta", resposta)

@sio.on("resultado")
def on_result(data):
    print("\n🔍 Resultado:")
    print("✅ Correto!" if data["correta"] else "❌ Incorreto!")
    print(f"📊 Pontuação atual: {data['pontuacao']}")
    input("\nPressione Enter para continuar...")
    sio.emit("proxima_pergunta")

@sio.on("fim")
def on_end(data):
    print("\n🏁 Fim do jogo!")
    print(f"📈 Pontuação final: {data['pontuacao']}/{data['totalPerguntas']}")
    sio.disconnect()

@sio.event
def disconnect():
    print("🔌 Desconectado do servidor")

if __name__ == "__main__":
    try:
        print("Conectando ao servidor de quiz...")
        sio.connect("http://localhost:3000", socketio_path="/api/socket")
        sio.wait()
    except Exception as e:
        print(f"Erro na conexão: {e}")
    except KeyboardInterrupt:
        print("\nJogo encerrado pelo usuário")
```

## ⚙️ Gerenciamento de Estado e Dados no Servidor

O servidor possui mecanismos internos para otimizar o desempenho e gerenciar os dados da sessão de cada jogador.

### Cache de Perguntas
Com o objetivo de reduzir a latência e o volume de requisições à API externa OpenTDB, o servidor implementa um **cache de perguntas** (denominado `questionCache` no código de referência). Quando um tema é selecionado por um jogador pela primeira vez, as perguntas correspondentes são buscadas na API e armazenadas nesse cache. Se outro jogador (ou o mesmo jogador em uma nova partida) selecionar o mesmo tema posteriormente, as perguntas são fornecidas diretamente a partir do cache. Isso resulta em um carregamento mais rápido das perguntas. O cache é indexado pelo ID da categoria.

### Limpeza de Dados da Sessão do Jogador
O servidor mantém o estado individual de cada jogador conectado (como a pontuação atual, a lista de perguntas do quiz em andamento e o índice da pergunta atual). Esses dados são associados ao `socket.id` da conexão do jogador. Para um gerenciamento eficiente dos recursos do servidor:
*   Os dados da sessão de um jogador são **automaticamente removidos 1 minuto após o término do jogo**. Essa limpeza é agendada após a emissão do evento `fim`.
*   Os dados da sessão também são **removidos imediatamente caso o jogador se desconecte** do servidor (ou seja, quando o evento `disconnect` é acionado).
Essas medidas garantem que os dados de jogadores inativos ou desconectados não consumam memória do servidor desnecessariamente.

## 🌐 Configuração do Servidor (Informações Relevantes para Clientes)

### CORS (Cross-Origin Resource Sharing)
A configuração de CORS no servidor Socket.io é um aspecto importante para permitir que clientes hospedados em domínios diferentes do servidor possam estabelecer conexões.
*   **Ambiente de Desenvolvimento:** Frequentemente, para facilitar o desenvolvimento local, o servidor pode estar configurado para aceitar conexões de qualquer origem (ex: `origin: "*"`).
*   **Ambiente de Produção:** Em um ambiente de produção, é crucial configurar o servidor para aceitar conexões apenas de origens (domínios) explicitamente permitidas. O código de referência do servidor inclui um placeholder (`"seu-dominio.com"`) que deve ser substituído pelo domínio real da sua aplicação cliente. Por exemplo, se a aplicação cliente estiver hospedada em `https://meuquizlegal.com`, o servidor deverá ser configurado para permitir conexões originadas desse domínio específico.

## 📌 Notas para Interoperabilidade e Considerações Adicionais

1.  **Codificação de Texto:** Os textos das perguntas e das alternativas, que são provenientes da API externa OpenTDB, passam por um processo de decodificação (URL decode RFC 3986) no servidor antes de serem enviados ao cliente. Portanto, os clientes geralmente não precisam realizar nenhuma decodificação adicional nesses campos e podem exibi-los diretamente.
2.  **Embaralhamento de Alternativas:** As alternativas de resposta para cada pergunta são sempre embaralhadas pelo servidor antes de serem enviadas ao cliente. Isso assegura que a posição da resposta correta varie cada vez que uma pergunta é apresentada, evitando padrões.
3.  **Estado do Jogo por Conexão:** O servidor gerencia o estado do jogo (progresso, pontuação) de forma individual para cada conexão de cliente, que é identificada pelo seu `socket.id`. Diferentes jogadores conectados simultaneamente têm seus estados de jogo isolados e não interferem uns nos outros.
4.  **Atraso no Envio da Pergunta:** Existe um pequeno atraso intencional (configurado no servidor para aproximadamente 300 milissegundos, via `setTimeout`) antes do envio de cada nova pergunta (evento `pergunta`). Este atraso pode contribuir para uma melhor experiência do usuário, criando uma breve pausa entre as perguntas. Os desenvolvedores de clientes devem estar cientes dessa característica do servidor.

Este guia detalhado visa capacitar os desenvolvedores a construir clientes interativos e funcionais para o servidor de Quiz Game Socket.io.
