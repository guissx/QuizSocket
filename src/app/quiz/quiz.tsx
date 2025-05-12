'use client';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Pergunta {
  id: string;
  texto: string;
  alternativas: string[];
  correta: number;
}

interface Tema {
  id: number;
  nome: string;
}

type GameState = 'selecionar_tema' | 'connecting' | 'playing' | 'result' | 'finished';

export default function QuizGame() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>('selecionar_tema');
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [pontuacao, setPontuacao] = useState(0);
  const [respostaSelecionada, setRespostaSelecionada] = useState<number | null>(null);
  const [respostaCorreta, setRespostaCorreta] = useState<number | null>(null);
  const [totalPerguntas, setTotalPerguntas] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [temasDisponiveis, setTemasDisponiveis] = useState<Tema[]>([]);

  useEffect(() => {
    const newSocket = io('', {
      path: '/api/socket',
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Conectado ao servidor');
    });

    newSocket.on('temas_disponiveis', (temas: Tema[]) => {
      setTemasDisponiveis(temas);
    });

    newSocket.on('pergunta', (perg: Pergunta) => {
      setPergunta(perg);
      setGameState('playing');
      setRespostaSelecionada(null);
      setRespostaCorreta(null);
    });

    newSocket.on('resultado', (data) => {
      setPontuacao(data.pontuacao);
      setRespostaCorreta(data.respostaCorreta);
      setGameState('result');
    });

    newSocket.on('fim', (data) => {
      setPontuacao(data.pontuacao);
      setTotalPerguntas(data.totalPerguntas);
      setGameState('finished');
      if (data.pontuacao === data.totalPerguntas) {
        setShowConfetti(true);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Desconectado do servidor');
      setGameState('selecionar_tema');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const selecionarTema = (temaId: number) => {
    if (!socket) return;
    setGameState('connecting');
    socket.emit('selecionar_tema', temaId);
  };

  const handleResposta = (indice: number) => {
    if (!socket || gameState !== 'playing') return;
    setRespostaSelecionada(indice);
    socket.emit('resposta', indice);
  };

  const avancarPergunta = () => {
    if (socket) {
      socket.emit('proxima_pergunta');
      setGameState('playing');
    }
  };

  const reiniciarJogo = () => {
    if (socket) {
      socket.disconnect();
    }
    setShowConfetti(false);
    setGameState('selecionar_tema');
  };

  const voltarAoInicio = () => {
    if (socket) {
      socket.disconnect();
    }
    setGameState('selecionar_tema');
    setPontuacao(0);
    setPergunta(null);
    setShowConfetti(false);
  };

  const getButtonClass = (index: number) => {
    const baseClasses = "w-full p-4 rounded-xl text-left transition-all duration-300 flex items-center";
    
    if (gameState === 'result') {
      if (index === respostaCorreta) 
        return `${baseClasses} bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg scale-[1.02]`;
      if (index === respostaSelecionada && index !== respostaCorreta) 
        return `${baseClasses} bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg`;
    }
    
    return `${baseClasses} bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 hover:shadow-md`;
  };

  // Tela de Seleção de Tema
  if (gameState === 'selecionar_tema') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center border border-gray-700/50 animate-fade-in">
          <div className="mb-8">
            <h1 className="text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              Quiz Do Guis
            </h1>
            <p className="text-lg text-gray-300">Escolha um tema para começar!</p>
          </div>
          
          <div className="space-y-4">
            {temasDisponiveis.map((tema) => (
              <button
                key={tema.id}
                onClick={() => selecionarTema(tema.id)}
                className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 transition-all duration-300 w-full text-lg font-semibold shadow-md hover:shadow-lg active:scale-95"
              >
                {tema.nome}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Tela de Conexão
  if (gameState === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center border border-gray-700/50">
          <h2 className="text-2xl font-bold mb-6">Carregando perguntas...</h2>
          <div className="flex justify-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Tela Final
  if (gameState === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
        {showConfetti && (
          <div className="absolute inset-0 flex justify-center items-start pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <div 
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>
        )}
        
        <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center border border-gray-700/50 z-10 animate-pop-in">
          <h1 className="text-4xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            {pontuacao === totalPerguntas ? 'Perfeito!' : pontuacao > totalPerguntas/2 ? 'Bom Trabalho!' : 'Quiz Completo!'}
          </h1>
          
          <div className="mb-8">
            <div className="inline-block bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full p-4 mb-4 shadow-lg">
              <div className="text-5xl font-bold">
                {pontuacao}<span className="text-gray-300">/{totalPerguntas}</span>
              </div>
            </div>
            <p className="text-lg text-gray-300 mt-4">
              {pontuacao === totalPerguntas ? '🎉 Você acertou todas as questões!' : 
               pontuacao > totalPerguntas/2 ? '👏 Excelente desempenho!' : '💡 Continue praticando para melhorar!'}
            </p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={reiniciarJogo}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 transition-all duration-300 w-full text-lg font-semibold shadow-md hover:shadow-lg active:scale-95"
            >
              Jogar Novamente
            </button>
            <button
              onClick={voltarAoInicio}
              className="px-6 py-3 bg-gray-700/50 hover:bg-gray-700/70 text-white rounded-xl transition-all duration-300 w-full text-lg shadow-md hover:shadow-lg active:scale-95"
            >
              Menu Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tela do Jogo (playing ou result)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-gray-700/50 animate-fade-in">
        <div className="mb-6 text-center">
          <div className="inline-block bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full px-6 py-2 shadow-lg">
            <h2 className="text-xl font-bold text-white">Pontuação: {pontuacao}</h2>
          </div>
        </div>
        
        {pergunta && (
          <div className="space-y-6">
            <div className="bg-gray-700/50 rounded-xl p-4 mb-4 border border-gray-600/30">
              <h3 className="text-xl font-medium text-white text-center">
                {pergunta.texto}
              </h3>
            </div>
            
            <div className="space-y-4">
              {pergunta.alternativas.map((alt, index) => (
                <button
                  key={index}
                  onClick={() => handleResposta(index)}
                  disabled={gameState !== 'playing' || respostaSelecionada !== null}
                  className={`${getButtonClass(index)} ${gameState === 'playing' && respostaSelecionada === null ? 'hover:scale-[1.02] active:scale-100' : ''}`}
                >
                  <span className="flex-1 font-medium text-left">{alt}</span>
                  {gameState === 'result' && index === respostaCorreta && (
                    <span className="ml-2">✅</span>
                  )}
                  {gameState === 'result' && index === respostaSelecionada && index !== respostaCorreta && (
                    <span className="ml-2">❌</span>
                  )}
                </button>
              ))}
            </div>

            {gameState === 'result' && (
              <button
                onClick={avancarPergunta}
                className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 transition-all duration-300 w-full text-lg font-semibold shadow-md hover:shadow-lg active:scale-95"
              >
                Próxima Pergunta
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}