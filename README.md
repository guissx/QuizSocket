# Quiz Game - Servidor Socket.io

## 📌 Visão Geral

Este projeto implementa um servidor de perguntas e respostas (quiz) usando Socket.io, permitindo que múltiplos clientes se conectem simultaneamente para jogar. O servidor oferece diferentes categorias de perguntas, gerencia o fluxo do jogo e calcula a pontuação dos jogadores.

## 🌐 Protocolo de Comunicação

### 📡 Eventos do Servidor para Cliente

| Evento                  | Descrição                                                                 | Estrutura de Dados                                                                 |
|-------------------------|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| `temas_disponiveis`     | Lista todas as categorias de perguntas disponíveis                        | `Array<{id: number, nome: string}>`                                               |
| `configuracao_inicial`  | Envia configurações iniciais quando um tema é selecionado                 | `{totalPerguntas: number}`                                                        |
| `pergunta`              | Envia a próxima pergunta para o jogador                                   | `{id: string, texto: string, alternativas: string[], correta: number}`           |
| `resultado`             | Retorna o resultado da resposta submetida pelo jogador                    | `{correta: boolean, respostaCorreta: number, pontuacao: number}`                 |
| `fim`                   | Indica que o jogo terminou e mostra a pontuação final                     | `{pontuacao: number, totalPerguntas: number}`                                    |
| `error`                 | Notifica o cliente sobre erros ocorridos                                  | `string` (mensagem de erro)                                                      |

### 📤 Eventos do Cliente para Servidor

| Evento                | Descrição                                                                 | Estrutura de Dados                 |
|-----------------------|---------------------------------------------------------------------------|-------------------------------------|
| `selecionar_tema`     | Seleciona uma categoria para iniciar o jogo                               | `number` (ID da categoria)         |
| `resposta`           | Submete uma resposta para a pergunta atual                                | `number` (índice da alternativa)   |
| `proxima_pergunta`    | Solicita a próxima pergunta ou finaliza o jogo                            | `void`                             |

## 📋 Especificação da API Socket.io

### 1. Inicialização da Conexão
- Endpoint: `/api/socket`
- Protocolo: WebSocket
- Autenticação: Não requerida

### 2. Fluxo do Jogo

1. **Conexão Inicial**:
   - Cliente se conecta ao servidor via Socket.io
   - Servidor envia imediatamente os temas disponíveis (`temas_disponiveis`)

2. **Seleção de Tema**:
   - Cliente envia `selecionar_tema` com o ID da categoria
   - Servidor responde com `configuracao_inicial` contendo o total de perguntas

3. **Rodada de Perguntas**:
   - Servidor envia a primeira pergunta (`pergunta`)
   - Cliente responde com `resposta` (índice da alternativa)
   - Servidor valida e envia feedback (`resultado`)
   - Cliente solicita próxima pergunta (`proxima_pergunta`)
   - Repete até acabarem as perguntas

4. **Fim do Jogo**:
   - Servidor envia resultados finais (`fim`)
   - Conexão pode ser mantida para um novo jogo

### 3. Estruturas de Dados

#### Pergunta:
```typescript
interface Pergunta {
  id: string;            // ID único da pergunta
  texto: string;         // Texto da pergunta (HTML escaped)
  alternativas: string[]; // Lista de alternativas (4 itens)
  correta: number;       // Índice da alternativa correta (0-3)
}
```

#### Resultado da Resposta:
```typescript
interface ResultadoResposta {
  correta: boolean;      // Se a resposta estava correta
  respostaCorreta: number; // Índice da resposta correta
  pontuacao: number;     // Pontuação acumulada
}
```

#### Categorias Disponíveis:
```typescript
interface Categoria {
  id: number;            // ID da categoria (usado para seleção)
  nome: string;          // Nome amigável da categoria
}
```

## 🛠️ Como Implementar um Cliente Compatível

1. Conecte-se ao endpoint do servidor
2. Escute por `temas_disponiveis` para mostrar as opções ao jogador
3. Implemente os handlers para:
   - Receber perguntas (`pergunta`)
   - Mostrar feedback (`resultado`)
   - Exibir tela final (`fim`)
4. Envie os eventos conforme o fluxo do jogo

Exemplo mínimo de cliente:

```javascript
import { io } from "socket.io-client";

const socket = io("http://endpoint-do-servidor/api/socket");

socket.on("temas_disponiveis", (categorias) => {
  console.log("Categorias disponíveis:", categorias);
  // Mostrar opções para o usuário
});

socket.on("pergunta", (pergunta) => {
  console.log("Nova pergunta:", pergunta.texto);
  console.log("Alternativas:", pergunta.alternativas);
  // Mostrar pergunta para o usuário
});

// Implementar outros handlers...

// Quando usuário selecionar tema:
socket.emit("selecionar_tema", categoriaId);

// Quando usuário responder:
socket.emit("resposta", indiceAlternativa);
```

## 📌 Notas para Interoperabilidade

1. Todos os textos são codificados/decodificados usando URL encoding
2. As alternativas sempre são embaralhadas pelo servidor
3. O servidor mantém o estado do jogo por conexão/sessão
4. Timeout padrão de 1 minuto após fim do jogo para limpeza de dados

