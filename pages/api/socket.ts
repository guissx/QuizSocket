// pages/api/socket.ts

import { Server, Socket } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";
import axios from 'axios';

// Tipos para perguntas
interface Pergunta {
  id: string;
  texto: string;
  alternativas: string[];
  correta: number;
}

// Tipo vindo da API externa 
interface PerguntaAPI {
  question: string;
  incorrect_answers: string[];
  correct_answer: string;
}

interface PlayerData {
  score: number;
  perguntas: Pergunta[];
  currentIndex: number;
}

interface ResultadoResposta {
  correta: boolean;
  respostaCorreta: number;
  pontuacao: number;
}

interface FimJogo {
  pontuacao: number;
  totalPerguntas: number;
}

interface ConfiguracaoInicial {
  totalPerguntas: number;
}

// Eventos Socket.io
interface ServerToClientEvents {
  pergunta: (pergunta: Pergunta) => void;
  resultado: (data: ResultadoResposta) => void;
  fim: (data: FimJogo) => void;
  error: (message: string) => void;
  configuracao_inicial: (data: ConfiguracaoInicial) => void;
  temas_disponiveis: (temas: { id: number, nome: string }[]) => void;
}

interface ClientToServerEvents {
  resposta: (indice: number) => void;
  proxima_pergunta: () => void;
  selecionar_tema: (categoryId: number) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  username?: string;
}

type NextApiResponseServerIO = NextApiResponse & {
  socket: NetSocket & {
    server: HTTPServer & {
      io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
    };
  };
};

// Categorias disponíveis
const categorias = [
  { id: 9, nome: "Conhecimentos Gerais" },
  { id: 18, nome: "Computação" },
  { id: 21, nome: "Esportes" },
  { id: 23, nome: "História" },
  { id: 15, nome: "Video Games" },
  { id: 11, nome: "Filmes" },
  { id: 12, nome: "Música" },
  { id: 31, nome: "Anime e Mangá" },
];

const pontuacoes: Record<string, PlayerData> = {};
const questionCache = new Map<number, Pergunta[]>();

async function fetchQuestions(category: number): Promise<Pergunta[]> {
  if (questionCache.has(category)) {
    return questionCache.get(category)!;
  }

  try {
    const response = await axios.get(
      `https://opentdb.com/api.php?amount=10&category=${category}&type=multiple&encode=url3986`
    );

    const perguntas = response.data.results.map((q: PerguntaAPI) => {
      const alternativas = [
        ...q.incorrect_answers.map((a) => decodeURIComponent(a)),
        decodeURIComponent(q.correct_answer),
      ];
      const alternativasEmbaralhadas = shuffleArray(alternativas);
      const corretaIndex = alternativasEmbaralhadas.indexOf(decodeURIComponent(q.correct_answer));

      return {
        id: Math.random().toString(36).substring(7),
        texto: decodeURIComponent(q.question),
        alternativas: alternativasEmbaralhadas,
        correta: corretaIndex,
      };
    });

    questionCache.set(category, perguntas);
    return perguntas;
  } catch (error) {
    console.error("Erro ao buscar perguntas:", error);
    throw error;
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    console.log("Iniciando Socket.io...");

    const httpServer: HTTPServer = res.socket.server as HTTPServer;
    const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
      httpServer,
      {
        path: "/api/socket",
        addTrailingSlash: false,
        cors: {
          origin: process.env.NODE_ENV === "development" ? "*" : "seu-dominio.com",
          methods: ["GET", "POST"],
        },
      }
    );

    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log(`Cliente conectado: ${socket.id}`);

      socket.emit("temas_disponiveis", categorias);

      socket.on("selecionar_tema", async (categoryId: number) => {
        try {
          const perguntas = await fetchQuestions(categoryId);
          pontuacoes[socket.id] = {
            score: 0,
            perguntas,
            currentIndex: 0,
          };

          socket.emit("configuracao_inicial", {
            totalPerguntas: perguntas.length,
          });

          enviarPergunta(socket);
        } catch (error) {
          console.error("Erro ao selecionar tema:", error);
          socket.emit("error", "Falha ao carregar perguntas. Tente novamente.");
        }
      });

      socket.on("resposta", (indice: number) => {
        try {
          const playerData = pontuacoes[socket.id];
          if (!playerData || playerData.currentIndex >= playerData.perguntas.length) {
            throw new Error("Estado do jogo inválido");
          }

          const perguntaAtual = playerData.perguntas[playerData.currentIndex];

          if (indice < 0 || indice >= perguntaAtual.alternativas.length) {
            throw new Error("Índice de resposta inválido");
          }

          const correta = perguntaAtual.correta === indice;
          if (correta) playerData.score += 1;

          socket.emit("resultado", {
            correta,
            respostaCorreta: perguntaAtual.correta,
            pontuacao: playerData.score,
          });

          playerData.currentIndex++;
        } catch (error) {
          console.error("Erro ao processar resposta:", error);
          socket.emit("error", error instanceof Error ? error.message : "Erro desconhecido");
        }
      });

      socket.on("proxima_pergunta", () => {
        try {
          const playerData = pontuacoes[socket.id];
          if (!playerData) {
            throw new Error("Jogador não encontrado");
          }

          if (playerData.currentIndex < playerData.perguntas.length) {
            enviarPergunta(socket);
          } else {
            const resultadoFinal: FimJogo = {
              pontuacao: playerData.score,
              totalPerguntas: playerData.perguntas.length,
            };
            socket.emit("fim", resultadoFinal);
            agendarLimpezaPontuacao(socket.id);
          }
        } catch (error) {
          console.error("Erro ao avançar pergunta:", error);
          socket.emit("error", error instanceof Error ? error.message : "Erro desconhecido");
        }
      });

      socket.on("disconnect", () => {
        console.log(`Cliente ${socket.id} desconectado`);
        limparPontuacao(socket.id);
      });
    });

    console.log("Socket.io iniciado com sucesso.");
  }
  res.end();
}

function enviarPergunta(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
  const playerData = pontuacoes[socket.id];
  if (!playerData || playerData.currentIndex >= playerData.perguntas.length) {
    console.error("Não foi possível enviar pergunta: estado inválido");
    return;
  }

  setTimeout(() => {
    socket.emit("pergunta", playerData.perguntas[playerData.currentIndex]);
  }, 300);
}

function agendarLimpezaPontuacao(socketId: string): void {
  setTimeout(() => limparPontuacao(socketId), 60000); // Limpa após 1 minuto
}

function limparPontuacao(socketId: string): void {
  if (pontuacoes[socketId]) {
    delete pontuacoes[socketId];
  }
}

// Função para embaralhar alternativas
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
