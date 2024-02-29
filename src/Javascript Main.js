/**
 * Initializes the quiz game, sets up event listeners, and manages the game state.
 */
document.addEventListener('DOMContentLoaded', async function () {
  // Declaration of variables to store game state, timer details, and session token.
  let sessionToken;
  let timer;
  let timeLeft = 30; // seconds
  let pauseTimeout;
  let askTheHostUsed = false;
  let fiftyFiftyUsed = false;
  let pauseUsed = false;
  let bestScore;
  let currentQuestions = [];
  let incorrectAnswers = 0;
  let correctAnswers = 0;
  let gameOver = false;
  const leaderboard = [];
  const maxLeaderboardSize = 10;

  const categories = {
            "9" : "General Knowledge",
            "10" : "Entertainment: Books", 
            "11" : "Entertainment: Film", 
            "12" : "Entertainment: Music", 
            "13" : "Entertainment: Musicals & Theatres", 
            "14" : "Entertainment: Television", 
            "15" : "Entertainment: Video Games", 
            "16" : "Entertainment: Board Games", 
            "17" : "Science & Nature", 
            "18" : "Science: Computers", 
            "19" : "Science: Mathematics", 
            "20" : "Mythology", 
            "21" : " Sports", 
            "22" : "Geography", 
            "23" : "History", 
            "24" : "Politics", 
            "25" : "Art", 
            "26" : "Celebrities", 
            "27" : "Animals", 
            "28" : "Vehicles", 
            "29" : "Entertainment: Comics", 
            "30" : "Science: Gadgets", 
            "31" : "Entertainment: Japanese Anime & Manga", 
            "32" : "Entertainment: Cartoon & Animations" }
      

  // Attempts to fetch a session token from Open Trivia Database API.
  try {
    const tokenResponse = await fetch('https://opentdb.com/api_token.php?command=request');
    const tokenData = await tokenResponse.json();
    sessionToken = tokenData.token;
  } catch (error) {
    console.error('Error fetching the session token:', error);
    return;
  }


  // Hides or displays game elements based on current game state.
  changeGameStateElements('start game');

  // Sets up event listeners for various game actions.
  setupEventListeners();


  /**
     * Fetches trivia questions from the Open Trivia Database API.
     * @param {number} category - The category of questions to fetch.
     * @param {string} difficulty - The difficulty level of the questions.
     */
  async function fetchTriviaQuestions(category = 9, difficulty = '') {
    // URL parameters for fetching questions.
    const generalAmount = 7;
    const bonusAmount = 5;
    const type = 'multiple';

    let generalQuestionsUrl = `https://opentdb.com/api.php?amount=${generalAmount}&category=${category}&difficulty=${difficulty}&type=${type}&token=${sessionToken}`;

    let bonusCategoryId = sessionStorage.getItem('bonusCategoryId');
    let bonusQuestionsUrl = `https://opentdb.com/api.php?amount=${bonusAmount}&category=${bonusCategoryId}&difficulty=${difficulty}&type=${type}&token=${sessionToken}`;

    let questions = [];

    if (!sessionToken) {
      console.error('No session token available.');
      return;
    }

    // Fetches and displays questions after retrieving them from the API.
    try {
      // Fetch general questions
      const generalData = await fetchWithRetry(generalQuestionsUrl);
      questions = generalData.results;
      console.log(category)

      // Fetch bonus questions
      const bonusCategoryId = sessionStorage.getItem('bonusCategoryId');
      if (bonusCategoryId) {
        console.log('Waiting before fetching bonus questions to avoid rate limit...');
        console.log(bonusCategoryId)
        changeGameStateElements('loading questions')

        await new Promise(resolve => setTimeout(resolve, 8600));

        const bonusData = await fetchWithRetry(bonusQuestionsUrl);
        let bonusQuestions = bonusData.results.map(question => ({ ...question, isBonus: true }));
        questions = [...questions, ...bonusQuestions];
      }

      // Sorts and displays fetched questions.
      currentQuestions = questions.sort(() => Math.random() - 0.5);
      displayQuestions(currentQuestions);
    } catch (error) {
      console.error('Fetching questions error:', error);
    }
  }

  // Helper function to fetch data with retry logic for rate-limited requests.
  async function fetchWithRetry(url) {
    let response;
    while (true) {
      try {
        response = await fetch(url);
        if (!response.ok) {
          if (response.status === 429) {
            console.log('Rate limit exceeded, retrying in 10 seconds...');
            changeGameStateElements('too many requests error')
            stopTimer()
            await new Promise(resolve => setTimeout(resolve, 8000));
          } else {
            throw new Error(`HTTP error: ${response.status}`);
          }
        } else {
          return await response.json();
        }
      } catch (error) {
        if (response && response.status !== 429) {
          throw error;
        }
        console.error('Fetch error:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }


  /**
    * Sets up event listeners for UI elements.
    */
  function setupEventListeners() {

    // Event listener for category selection change.
    document.getElementById('category-dropdown').addEventListener('change', function () {
      const selectedCategory = this.value;
      const selectedDifficulty = document.getElementById('difficulty-dropdown').value;
      if (selectedCategory > 8) {
        fetchTriviaQuestions(selectedCategory, selectedDifficulty !== 'any-difficulty' ? selectedDifficulty : '');
      }
    });

    // Event listener for difficulty selection change.
    document.getElementById('difficulty-dropdown').addEventListener('change', function () {
      let selectedDifficulty = this.value;
      let selectedCategory = document.getElementById('category-dropdown').value;
      if (selectedCategory <= 8 || selectedCategory === '') {
        selectedCategory = '9'; // Default category if none is selected
        document.getElementById('category-dropdown').value = selectedCategory;
      }

      if (selectedDifficulty !== 'any-difficulty') {
        fetchTriviaQuestions(selectedCategory, selectedDifficulty);
      }
    });

    // Starts game and displays bonus category selection when start game button is clicked.
    document.getElementById('start-game').addEventListener('click', function () {
      displayBonusCategorySelection();
      changeGameStateElements('bonus cat selection')
    });

    // Ends game and changes state to 'game over' when quit game button is clicked.
    document.getElementById('quit-game').addEventListener('click', function () {
      endGame();
      changeGameStateElements('game over')
    });

    // Resets game to initial state when start over button is clicked.
    document.getElementById('start-over').addEventListener('click', function () {
      document.getElementById('question-container').innerHTML = '';
      document.getElementById('answer-container').innerHTML = '';
      document.getElementById('game-controls').style.flexDirection = 'row';
      resetBonusCategorySelection();
      restartGame();
    });

    // Begins a new game while keeping current game settings when new game button is clicked.
    document.getElementById('new-game').addEventListener('click', function () {
      document.getElementById('question-container').innerHTML = '';
      document.getElementById('answer-container').innerHTML = '';
      document.getElementById('bonus-category-selection').innerHTML = '';
      resetBonusCategorySelection();
      restartGame();
    });

    // Activates fifty-fifty helper, removing two incorrect answers, when clicked.
    document.getElementById('fifty-fifty').addEventListener('click', function () {
      const questionIndex = document.querySelector('.question')?.dataset?.questionIndex;
      if (questionIndex !== undefined && !this.classList.contains('used')) {
        removeTwoIncorrectAnswers(questionIndex);
        this.classList.add('used');
        this.disabled = true;
        this.style.opacity = '0.5';
        this.style.cursor = 'not-allowed';
      }
    });

    // Pauses timer for 60 seconds when pause timer button is clicked.
    document.getElementById('pause-timer').addEventListener('click', function () {
      if (!pauseUsed && timer) {
        this.classList.add('used');
        this.disabled = true;
        this.style.opacity = '0.5';
        this.style.cursor = 'not-allowed';
        pauseTimer()
        pauseTimeout = setTimeout(() => {
          if (!gameOver) {
            startTimer(timeLeft, 'time-left');
          }
        }, 60000);
      }
    });

    // Provides an answer from host when ask the host button is clicked.
    document.getElementById('ask-the-host').addEventListener('click', function () {
      const questionIndex = document.querySelector('.question')?.dataset?.questionIndex;
      if (questionIndex !== undefined && !this.classList.contains('used')) {
        askTheHostUsed = true;
        const question = currentQuestions[questionIndex];
        const confidence = calculateConfidence(question.difficulty);
        const answer = provideAnswer(question.correct_answer, confidence);
        displayHostAnswer(answer, confidence);
        this.classList.add('used');
        this.disabled = true;
        this.style.opacity = '0.5';
        this.style.cursor = 'not-allowed';
      }
    });
  }


  /**
  * Changes visibility and state of game elements based on the current game phase.
  * @param {string} state - The current state of the game ('start game', 'loading questions', 'game over', etc.).
   */
  function changeGameStateElements(state) {
    if (state == 'start game') {
      document.getElementById('game-playing').style.display = 'none';
      document.getElementById('fetching-bonus').style.display = 'none';
      document.getElementById('game-over').style.display = 'none';
      document.getElementById('new-game').style.display = 'none';
      document.getElementById('error-container').style.display = 'none';
      document.getElementById('start-game').style.display = 'flex';
      document.getElementById('bonus-category-selection').style.display = 'none';
      document.getElementById('score-board').style.display = 'none';
      document.getElementById('score-board').style.flexDirection = 'none';
    }
    else if (state == 'bonus cat selection') {
      document.getElementById('game-playing').style.display = 'none';
      document.getElementById('fetching-bonus').style.display = 'none';
      document.getElementById('game-over').style.display = 'none';
      document.getElementById('new-game').style.display = 'none';
      document.getElementById('error-container').style.display = 'none';
      document.getElementById('start-game').style.display = 'none';
      document.getElementById('bonus-category-selection').style.display = 'flex';
      document.getElementById('score-board').style.display = 'none';
      document.getElementById('score-board').style.flexDirection = 'none';
    }
    else if (state == 'loading questions') {
      document.getElementById('game-playing').style.display = 'none';
      document.getElementById('fetching-bonus').style.display = 'block';
      animateLoadingBar();
      document.getElementById('game-over').style.display = 'none';
      document.getElementById('new-game').style.display = 'none';
      document.getElementById('error-container').style.display = 'none';
      document.getElementById('start-game').style.display = 'none';
      document.getElementById('bonus-category-selection').style.display = 'none';
      document.getElementById('score-board').style.display = 'none';
      document.getElementById('score-board').style.flexDirection = 'none';
    }
    else if (state == 'game playing') {
      document.getElementById('game-playing').style.display = 'block';
      document.getElementById('fetching-bonus').style.display = 'none';
      document.getElementById('game-over').style.display = 'none';
      document.getElementById('new-game').style.display = 'none';
      document.getElementById('error-container').style.display = 'none';
      document.getElementById('start-game').style.display = 'none';
      document.getElementById('bonus-category-selection').style.display = 'none';
      document.getElementById('score-board').style.display = 'flex';
      document.getElementById('score-board').style.flexDirection = 'row';
    }
    else if (state == 'game over') {
      document.getElementById('game-playing').style.display = 'none';
      document.getElementById('fetching-bonus').style.display = 'none';
      document.getElementById('game-over').style.display = 'flex';
      document.getElementById('new-game').style.display = 'block';
      document.getElementById('error-container').style.display = 'none';
      document.getElementById('start-game').style.display = 'none';
      document.getElementById('bonus-category-selection').style.display = 'none';
      document.getElementById('score-board').style.display = 'flex';
      document.getElementById('score-board').style.flexDirection = 'row';
    }
    else if (state == 'too many requests error') {
      document.getElementById('game-playing').style.display = 'none';
      document.getElementById('fetching-bonus').style.display = 'none';
      document.getElementById('game-over').style.display = 'none';
      document.getElementById('new-game').style.display = 'none';
      document.getElementById('error-container').style.display = 'block';
      animateLoadingBar();
      document.getElementById('start-game').style.display = 'none';
      document.getElementById('bonus-category-selection').style.display = 'none';
      document.getElementById('score-board').style.display = 'none';
      document.getElementById('score-board').style.flexDirection = 'none';
    }
  }


  /**
   * Displays the fetched questions and their respective answers.
   * @param {Array} questions - An array of question objects fetched from the API.
   */
  function displayQuestions(questions) {
    let questionContainer = document.getElementById('question-container');
    let answerContainer = document.getElementById('answer-container');

    // Updates UI elements to reflect game playing state.
    changeGameStateElements('game playing')
    // Starts or resets the timer for answering questions.
    startTimer();
    // Clears previous question and answer content.
    questionContainer.innerHTML = '';
    answerContainer.innerHTML = '';

    currentQuestions = questions;
    // Displays first question if there are questions available.
    if (currentQuestions.length > 0) {
      displayNextQuestion(0);
    } else {
      console.log('No questions to display');
    }
  }


  /**
   * Shuffles the order of the answers for a given question.
   * @param {Array} answers - An array of answer strings.
   * @returns {Array} The shuffled array of answers.
   */
  function shuffleAnswers(answers) {
    return answers.sort(() => Math.random() - 0.5);
  }


  /**
   * Displays the next question and its answers.
   * @param {number} questionIndex - The index of the current question in the questions array.
   */
  function displayNextQuestion(questionIndex) {
    const question = currentQuestions[questionIndex];
    // Checks if question is bonus question (additional points).
    const questionContainer = document.getElementById('question-container');
    const questionEl = document.createElement('div');
    const timeDisplay = document.getElementById('time-left');
    const answersEl = document.getElementById('answer-container');
    // Shuffles answers to display in random order.
    const answers = shuffleAnswers([question.correct_answer, ...question.incorrect_answers]);


    if (gameOver) {
      // Clears containers if game is over.
      document.getElementById('answer-container').innerHTML = '';
      document.getElementById('question-container').innerHTML = '';
      changeGameStateElements('game over')
      return;
    }

    if (questionIndex >= currentQuestions.length) {
      // Ends game if there are no more questions.
      endGame();
      return;
    }

    // Marks question as a bonus question if applicable.
    let isBonus = question.category === categories[sessionStorage.getItem('bonusCategoryId')];

    console.log(isBonus)
    if (isBonus) {
      console.log('change bonus color')
      questionEl.classList.add('bonus-question');
    }

    questionContainer.innerHTML = '';

    // Sets question text and index data attribute.
    questionEl.classList.add('question');
    questionEl.dataset.questionIndex = questionIndex;
    questionEl.innerHTML = `<h2>Q${questionIndex + 1}: ${question.question}</h2>`;

    // Resets and starts timer for new question.
    stopTimer();
    startTimer(30, 'time-left');

    answersEl.innerHTML = '';

    // Creates and appends answer buttons for each answer.
    answers.forEach(answer => {
      const answerBtn = document.createElement('button');
      const listItem = document.createElement('li');
      answerBtn.classList.add('answer-btn');
      answerBtn.innerHTML = answer;
      answerBtn.onclick = () => selectAnswer(answer, question.correct_answer, questionIndex);

      listItem.appendChild(answerBtn);
      answersEl.appendChild(listItem);
    });

    questionContainer.appendChild(questionEl);
  }


  /**
   * Updates the display of correct and incorrect answer counts based on the user's answer.
   * @param {boolean} isCorrect - Indicates whether the user's answer is correct or not.
   */
  function updateAnswerCounts(isCorrect) {
    // Retrieves and parses current counts of correct and incorrect answers from the DOM.
    let correctCount = parseInt(document.getElementById('correct-answers').textContent.split(': ')[1]);
    let incorrectCount = parseInt(document.getElementById('incorrect-answers').textContent.split(': ')[1]);

    // Increments correct count and updates DOM if answer is correct.
    if (isCorrect) {
      correctCount++;
      document.getElementById('correct-answers').textContent = `Correct: ${correctCount}`;
    }
    // Otherwise, increments incorrect count and updates DOM.
    else {
      incorrectCount++;
      document.getElementById('incorrect-answers').textContent = `Incorrect: ${incorrectCount}`;
    }
  }


  /**
   * Handles the user's answer selection, updates the score or incorrect answers count, and loads the next question.
   * @param {string} selectedAnswer - The answer selected by the user.
   * @param {string} correctAnswer - The correct answer to the question.
   * @param {number} questionIndex - The index of the current question in the array.
   */
  function selectAnswer(selectedAnswer, correctAnswer, questionIndex) {
    const question = currentQuestions[questionIndex];
    const answerBtns = document.querySelectorAll(`.answer-btn`);
    const isCorrect = selectedAnswer === correctAnswer;
    updateAnswerCounts(isCorrect);

    if (isCorrect) {
      console.log('Correct answer!');
      updateScore(question.difficulty);
    } else {
      console.log('Wrong answer!');
      incorrectAnswers++;
      checkEndGame();
    }
    answerBtns.forEach(btn => {
      btn.disabled = true;
      if (btn.innerHTML == selectedAnswer) {
        let color = (btn.innerHTML === correctAnswer) ? 'DarkSeaGreen' : 'LightCoral';
        btn.style.backgroundColor = color;
      }
    });
    setTimeout(() => {
      if (questionIndex < currentQuestions.length - 1) {
        displayNextQuestion(questionIndex + 1);
      } else {
        endGame();
      }
    }, 1500);
  }



  //Game State Functions
  /**
   * Checks if the game should end based on the number of incorrect answers.
   */
  function checkEndGame() {
    // Ends game if player has answered incorrectly 3 times.
    if (incorrectAnswers >= 3) {
      endGame();
      console.log('game over!')
    }
  }


  /**
   * Handles the end of the game, updates the UI, and resets timers.
   */
  function endGame() {
    gameOver = true; // Marks game as over.
    stopTimer(); // Stops game timer.
    console.log('timer stopped')

    // Clear timers
    clearTimeout(pauseTimeout);
    clearInterval(timer);

    // Updates UI to show final number of incorrect answers.
    document.getElementById('incorrect-answers').textContent = 'Incorrect: ' + incorrectAnswers;
    document.getElementById('bonus-category-selection').innerHTML = '';

    // Show Game Over container
    document.getElementById('game-over');

    // Switches UI to game over state.
    changeGameStateElements('game over')

    // Compares current score with best score and updates if higher.
    let currentScore = parseInt(document.getElementById('current-score').textContent);
    if (!bestScore || currentScore > bestScore) {
      bestScore = currentScore;
      document.getElementById('best-score').textContent = bestScore;
      document.getElementById('current-score').textContent = currentScore;
    } else {
      document.getElementById('current-score').textContent = currentScore;
    }
    // Updates leaderboard with final score.
    updateLeaderboard(currentScore);

    // Updates count of correct and incorrect answers for UI.
    updateAnswerCounts();
  }


  /**
   * Updates the player's score based on the difficulty of the question answered.
   * @param {string} difficulty - The difficulty level of the question answered.
   */
  function updateScore(difficulty) {
    let bonusCategoryId = sessionStorage.getItem('bonusCategoryId');
    // Points awarded based on question difficulty.
    const difficultyPoints = {
      'easy': 1,
      'medium': 2,
      'hard': 3
    };
    let pointsToAdd = difficultyPoints[difficulty];

    // Doubles points if answering a bonus category question.
    if (bonusCategoryId) {
      pointsToAdd *= 2;
    }

    // Updates and displays new score.
    let currentScore = parseInt(document.getElementById('current-score').textContent);
    currentScore += pointsToAdd;
    document.getElementById('current-score').textContent = currentScore;
  }


  /**
    * Resets the game to its initial state, ready for a new game.
    */
  function restartGame() {
    gameOver = false;
    resetGameControls();
    updateAnswerCounts();
    document.getElementById('bonus-category-selection').innerHTML = '';

    // Reset score display
    document.getElementById('current-score').textContent = '0';

    document.getElementById('incorrect-answers').textContent = 'Incorrect: ' + incorrectAnswers;

    document.getElementById('correct-answers').textContent = 'Correct: ' + correctAnswers;

    let selectedCategory = document.getElementById('category-dropdown').value;
    let selectedDifficulty = document.getElementById('difficulty-dropdown').value;

    // Clear question and answer contents
    document.getElementById('question-container').innerHTML = '';
    document.getElementById('answer-container').innerHTML = '';

    if (!selectedCategory || selectedCategory <= 8) {
      selectedCategory = '9';
    }
    if (selectedDifficulty === 'any-difficulty' || selectedDifficulty === 'difficulty') {
      selectedDifficulty = '';
    }
   
    // Call functions to reset 
    displayBonusCategorySelection();
    resetLoadingBar();
  }


  /**
   * Resets game controls, 50:50, pause timer, ask the host to game's initial state.
   */
  function resetGameControls() {
    incorrectAnswers = 0; // Reset incorrect answers count.
    correctAnswers = 0; // Reset correct answers count.
    askTheHostUsed = false; // Reset 'Ask the Host' helper usage.
    pauseUsed = false; // Reset pause usage.
    fiftyFiftyUsed = false;
    clearTimeout(pauseTimeout);

    // Reset 50:50 button
    const fiftyFiftyButton = document.getElementById('fifty-fifty');
    fiftyFiftyButton.classList.remove('used');
    fiftyFiftyButton.disabled = false;
    fiftyFiftyButton.style.opacity = '1';
    fiftyFiftyButton.style.cursor = 'pointer';

    // Reset pause button
    const pauseButton = document.getElementById('pause-timer');
    pauseButton.disabled = false;

    // Reset Ask the Host button
    const askTheHostButton = document.getElementById('ask-the-host');
    askTheHostButton.classList.remove('used');
    askTheHostButton.disabled = false;
    askTheHostButton.style.opacity = '1';
    askTheHostButton.style.cursor = 'pointer';
  }


  //Timer
  /**
   * Starts a countdown timer for the current question.
   * @param {number} duration - The duration of the timer in seconds.
   * @param {string} displayElementId - The ID of the element to display the timer's countdown.
   */
  function startTimer(duration, displayElementId) {
    clearInterval(timer); // Clears any existing timer.
    let timeLeft = duration;
    let totalLength = 339.292; // total length of SVG circle stroke.
    let interval = 100; // Interval for timer update in milliseconds.
    const display = document.getElementById(displayElementId);
    const circle = document.querySelector('#timer-svg circle');
    circle.style.strokeDashoffset = '0'; // Reset circle's stroke offset.

    timer = setInterval(function () {
      timeLeft -= interval / 1000;
      if (display) {
        display.textContent = Math.ceil(timeLeft).toString(); // Update display with remaining time.
        let offset = ((duration - timeLeft) / duration) * totalLength;
        circle.style.strokeDashoffset = offset.toString(); // Update SVG circle's stroke offset to reflect remaining time.
      } else {
        console.log('Display element not found');
      }
      if (timeLeft <= 0) {
        clearInterval(timer);
        handleTimeOut(); // Handle timeout when time reaches 0.
      }
    }, interval);
  }


  /**
   * Stops the active timer and clears any pause timeouts.
   */
  function stopTimer() {
    clearInterval(timer);
    clearTimeout(pauseTimeout);
  }


  /**
   * Pauses the timer for a set duration.
   */
  function pauseTimer() {
    if (pauseUsed) {
      return; // Do nothing if pause has already been used.
    } else {
      clearInterval(timer);
      pauseUsed = true;
      // Sets a timeout to resume timer after a delay.
      setTimeout(() => {
        if (!gameOver) { // Only resume timer if game is not over.
          startTimer(timeLeft, 'time-left');
          pauseUsed = false;
        }
      }, 60000); // 60 seconds pause.
    }
  }


  /**
   * Handles actions to be performed when the timer runs out.
   */
  function handleTimeOut() {
    console.log("Time's up!");
    incorrectAnswers++; // Increment incorrect answers count.
    checkEndGame();
    updateScore('timeout');

    // Display timeout modal and handle closure.
    var modal = document.getElementById('timeout-modal');
    var span = document.getElementsByClassName('close-button')[0];
    let questionDuration = 30;

    modal.style.display = 'block';

    // Hide modal and proceed to next question or end game.
    span.onclick = function () {
      modal.style.display = 'none';
      if (currentQuestions.length > 0) {
        displayNextQuestion(0);
        startTimer(questionDuration, 'time-left');
      } else {
        endGame();
      }
    }
  }


  // Fifty Fifty
  /**
   * Removes two incorrect answers for the current question, aiding the player in choosing the correct answer.
   * @param {number} questionIndex - Index of the current question in the quiz.
   */
  function removeTwoIncorrectAnswers(questionIndex) {
    const question = currentQuestions[questionIndex];
    let answers = [question.correct_answer, ...question.incorrect_answers];
    // Filter out correct answer to only work with incorrect ones.
    let incorrectAnswers = answers.filter(answer => answer !== question.correct_answer);

    // Randomly remove two incorrect answers.
    while (incorrectAnswers.length > 1) {
      const randomIndex = Math.floor(Math.random() * incorrectAnswers.length);
      const answerToRemove = incorrectAnswers[randomIndex];
      incorrectAnswers = incorrectAnswers.filter(answer => answer !== answerToRemove);

      // Update UI to reflect removal of incorrect answers.
      const answerBtns = document.querySelectorAll('.answer-btn');
      answerBtns.forEach(btn => {
        if (btn.innerHTML === answerToRemove) {
          btn.style.backgroundColor = 'LightCoral';
          btn.disabled = true;
          fiftyFiftyUsed = true;
        }
      });
    }
  }


  //Ask the host
  /**
   * Calculates the host's confidence level in providing the correct answer based on question difficulty.
   * @param {string} difficulty - Difficulty level of the current question.
   * @returns {number} Confidence level as a decimal.
   */
  function calculateConfidence(difficulty) {
    if (difficulty === 'easy') {
      return 0.9;
    } else if (difficulty === 'medium') {
      return 0.7;
    } else {
      return 0.5;
    }
  }


  /**
   * Provides an answer based on the host's confidence level.
   * @param {string} correctAnswer - The correct answer to the question.
   * @param {number} confidence - The host's confidence level in their answer.
   * @returns {string} The answer provided by the host.
   */
  function provideAnswer(correctAnswer, confidence) {
    const randomValue = Math.random();
    const questionIndex = document.querySelector('.question')?.dataset?.questionIndex;
    if (randomValue < confidence) {
      return correctAnswer;
    } else if (randomValue < 0.9) {
      return 'I am not sure.';
    } else {
      const answers = currentQuestions[questionIndex].incorrect_answers;
      return answers[Math.floor(Math.random() * answers.length)];
    }
  }


  /**
   * Displays the host's answer on the UI.
   * @param {string} answer - The answer provided by the host.
   * @param {number} confidence - The host's confidence level in their answer.
   */
  function displayHostAnswer(answer, confidence) {
    askTheHostUsed = true;
    const answerContainer = document.getElementById('answer-container');
    const hostAnswerElement = document.createElement('div');
    hostAnswerElement.classList.add('host-answer');
    hostAnswerElement.innerHTML = `<p>Host: '${answer}' (Confidence: ${Math.round(confidence * 100)}%)</p>`;
    answerContainer.appendChild(hostAnswerElement);
  }


  // Leader Board
  /**
   * Updates the leaderboard with the current score and ensures it doesn't exceed the maximum size.
   * @param {number} score - The player's score to be added to the leaderboard.
   */
  function updateLeaderboard(score) {
    const leaderboardList = document.getElementById('top-scores-list');
    leaderboard.push({ score });
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > maxLeaderboardSize) {
      leaderboard.pop();
    }

    // Update the leaderboard display.
    leaderboardList.innerHTML = '';
    leaderboard.forEach((entry) => {
      const listItem = document.createElement('li');
      listItem.textContent = `Score: ${entry.score}`;
      leaderboardList.appendChild(listItem);
    });
  }


  //Bonus Category
  /**
   * Fetches all trivia categories from the Open Trivia Database and displays them for bonus category selection.
   */
  async function fetchAllCategories() {
    const url = 'https://opentdb.com/api_category.php';
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.trivia_categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }


  /**
   * Asynchronously fetches all available categories from the trivia API and displays a selection
   * for the user to choose a bonus category.
   */
  async function displayBonusCategorySelection() {
    // Fetches all categories from trivia API.
    const categories = await fetchAllCategories();

    // Randomly selects 4 categories to display as options.
    let selectedCategories = categories.sort(() => 0.5 - Math.random()).slice(0, 4);

    const container = document.getElementById('bonus-category-selection');
    container.innerHTML = '';
    changeGameStateElements('bonus cat selection') // Updates UI to show bonus category selection.

    // Title 
    const title = document.createElement('h1');
    title.textContent = "Choose a Bonus Category!";
    container.appendChild(title);

    // Bonus cat options
    selectedCategories.forEach(category => {
      const button = document.createElement('button');
      button.textContent = category.name;
      button.onclick = () => selectBonusCategory(category.id);
      container.appendChild(button);
    });

    container.style.display = 'flex';
  }


  /**
   * Sets the selected category as the bonus category and fetches questions for that category.
   * @param {number} bonusCategoryId - The ID of the selected category to set as the bonus category.
   */
  function selectBonusCategory(bonusCategoryId) {
    sessionStorage.setItem('bonusCategoryId', bonusCategoryId);

    // Clears content of question and answer containers.
    document.getElementById('question-container').innerHTML = '';
    document.getElementById('answer-container').innerHTML = '';

    // Fetches questions for selected bonus category and updates game state accordingly.
    fetchTriviaQuestions().then(() => {
      changeGameStateElements('game-playing')
    }).catch(error => {
      console.error('Error fetching questions:', error);
    })
  }


  /**
   * Resets the bonus category selection and displays the selection options again.
   */
  function resetBonusCategorySelection() {
    sessionStorage.removeItem('bonusCategoryId');
    displayBonusCategorySelection();
  }


  // Loading Bar animation
  /**
   * Animates the loading bar by cycling through predefined states to indicate   progress.
   */
  function animateLoadingBar() {
    const loadingBar = document.getElementById('loading-bar');
    // Array of strings representing different states of loading bar.
    const loadingStates = [
      'Loading... ■▢▢▢▢▢▢▢▢▢ 10%',
      'Loading... ■■▢▢▢▢▢▢▢▢ 20%',
      'Loading... ■■■▢▢▢▢▢▢▢ 30%',
      'Loading... ■■■■▢▢▢▢▢▢ 40%',
      'Loading... ■■■■■▢▢▢▢▢ 50%',
      'Loading... ■■■■■■▢▢▢▢ 60%',
      'Loading... ■■■■■■■▢▢▢ 70%',
      'Loading... ■■■■■■■■▢▢ 80%',
      'Loading... ■■■■■■■■■▢ 90%',
      'Done! ■■■■■■■■■■ 100%',
    ];

    let currentIndex = 0;

    // Interval to update loading bar's text content, simulating progress.
    const intervalId = setInterval(() => {
      if (currentIndex >= loadingStates.length) {
        clearInterval(intervalId); // Stops animation when all states are displayed.
      } else {
        loadingBar.textContent = loadingStates[currentIndex++];
      }
    }, 800); // Changes state every 800ms.
  }


  /**
   * Resets the loading bar to its initial state.
   */
  function resetLoadingBar() {
    const loadingBar = document.getElementById('loading-bar');
    if (loadingBar) {
      loadingBar.textContent = 'Loading... ▢▢▢▢▢▢▢▢▢▢ 0%';
    }
  }
});