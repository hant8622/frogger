import "./style.css";

import { fromEvent, interval, merge } from 'rxjs';
import { map, filter, scan } from 'rxjs/operators';

function main() {
  /**
   * This is the view for your game to add and update your game elements.
   */
  //
  type Key = "KeyA" | "KeyD" | "KeyW" | "KeyS" | "Enter";

  // Game Constants
  const CONSTANTS = {
    TICK:100,
    CANVAS_SIZE:600,
    FROG_START_X:279,
    FROG_START_Y:523,
    FROG_STEP_X:43,
    FROG_STEP_Y:59,
    FROG_WIDTH:40,
    FROG_HEIGHT:42,
    CAR_COUNT:3,
    CAR_WIDTH:40,
    CAR_HEIGHT:42,
    CAR1_SPEED:-10,
    CAR2_SPEED:20,
    CAR3_SPEED:-15,
    LOG_COUNT:3,
    LOG_WIDTH:140,
    LOG_HEIGHT:42,
    LOG1_SPEED:10,
    LOG2_SPEED:15,
    TURTLE_WIDTH:180,
    TURTLE_HEIGHT:42,
    TURTLE_SPEED:-5,
    TURTLE_COUNT:3,
    TARGET_POINTS:100, 
    TARGET_COUNT:5,
    TARGET_INDEX: [0,1,2,3,4],
    ROW_1:464,
    ROW_2:405,
    ROW_3:346,
    ROW_4:228,
    ROW_5:169,
    ROW_6:110,
    ROW_7:51,
    OBJECT_WIDTH:200,
    OBJECT_SPACING:-500,
    BUSH_WIDTH:129,
    SPEED_INCREASE:0.5,
  } as const

  // Game state transitions for the observables 
  class Tick {constructor(public readonly num:number){}}
  class Move {constructor(public readonly x:number, public readonly y:number){}}
  class Restart {constructor(public readonly val:boolean){}}

  // Main observables for the movement and control of the frog
  // Listens for specific W,A,S,D keyboard presses and executes a stream
  const keyObservable$ = <T>(k:Key, result:()=>T) => fromEvent<KeyboardEvent>(document, "keydown").pipe(
    filter(({code}) => code === k),
    filter(({repeat})=>!repeat),
    map(result)
  ),
  moveLeft$ = keyObservable$("KeyA", ()=>new Move(-CONSTANTS.FROG_STEP_X, 0)),
  moveRight$ = keyObservable$("KeyD", ()=>new Move(CONSTANTS.FROG_STEP_X, 0)),
  moveUp$ = keyObservable$("KeyW", ()=>new Move(0, -CONSTANTS.FROG_STEP_Y)),
  moveDown$ = keyObservable$("KeyS", ()=>new Move(0, CONSTANTS.FROG_STEP_Y)),
  restart$ = keyObservable$("Enter", ()=>new Restart(true));

  // Primarily the in-game clock of the entire game and follows a tick every 100 milliseconds 
  const tick$ = interval(CONSTANTS.TICK).pipe(
    map((signal)=>new Tick(signal))
  );
  
  // General frog type and declared as readonly
  // Used to store the properties and behaviours of the frog
  type Frog = Readonly<{
    id:string,
    x:number,
    y:number,
    img:string,
    width:number,
    height:number,
  }>

  // Interface that inherits the properties of Frog type and contains an extra feature
  interface IBody extends Frog {
    leftDirection:boolean, // true when object moves from left to right and false when object moves from right to left
  }

  // General body type for most objects and declared as readonly
  // Used to store the properties and behaviours of cars, logs, turtles and more
  type Body = Readonly<IBody>

  // General state type containing features in the game and declared as readonly
  // Within the state type, readonly arrays are present to prevent side effects of the array
  type State = Readonly<{
    frog:Frog,
    cars:Readonly<Body[]>,
    logs:Readonly<Body[]>,
    turtles:Readonly<Body[]>,
    filledSpaces: Readonly<Body[]>,
    filledSpacesIndex: Readonly<number[]>,
    score:number,
    highscore:number,
    level:number,
    gameOver:boolean,
  }>

  // Types for the following object creators
  type FrogCreator = (id:string) => (img:string) => ([x, y]: readonly[number, number]) => ([width, height]: readonly[number, number]) => Frog;
  type MultipleRowCreator = (row:number) => (col:number, bodies:Body[]) => Body[];
  type SingleRowCreator = (col:number, bodies:Body[]) => Body[];


  const 
    // Creates a frog object for the player to control
    createFrog:FrogCreator = (id:string) => (img:string) => ([x, y]: readonly[number, number]) => ([width, height]: readonly[number, number]) => <Frog>{
      id,
      x,
      y,
      img,
      width,
      height,
    },

    // Creates a row of car objects for a specific row
    createCarRow:MultipleRowCreator = (row:number) => (col:number, cars:Body[]):Body[] => {
      // If col === 0, it returns an [] as it means there aren't any cars 
      if (!col) {
        return cars
      // If car objects > 0, it will create col amount of cars in that specific row
      } else {
        const newCar: Body = {
          id: `CAR${row}-${col}`,
          leftDirection: !(row % 2), // If row is odd, cars move from right to left. If row is even, cars move from left to right
          x: col*CONSTANTS.OBJECT_WIDTH, // Sets the spacing of each car
          y: row === 3 ? CONSTANTS.ROW_3 : row === 2? CONSTANTS.ROW_2 : CONSTANTS.ROW_1, // Sets the specific row for each car
          img: row === 3 ? "../frogger/assets/car3.png" : row === 2? "../frogger/assets/car2.png" : "../frogger/assets/car1.png",
          width: CONSTANTS.CAR_WIDTH,
          height: CONSTANTS.CAR_HEIGHT,
        }
        // Recursively calls for the creation of the remaining cars
        return createCarRow(row)(col-1, cars.concat([newCar]));
      }
    },
    // Creates car-specified rows
    car1 = createCarRow(1),
    car2 = createCarRow(2),
    car3 = createCarRow(3),

    // Creates a row of log objects for a specific row
    createLogRow:MultipleRowCreator = (row:number) => (col:number, logs:Body[]):Body[] => {
      // If col === 0, it returns an [] as it means there aren't any logs 
      if (!col) {
        return logs
      // If log objects > 0, it will create col amount of logs in that specific row
      } else {
        const newLog: Body = {
          id: `LOG${row}-${col}`,
          leftDirection: false,
          x: col*CONSTANTS.OBJECT_WIDTH, // Sets the spacing of each log
          y: row === 2 ? CONSTANTS.ROW_6 : CONSTANTS.ROW_4, // Sets the specific row for each log
          img: "../frogger/assets/log.png",
          width: CONSTANTS.LOG_WIDTH,
          height: CONSTANTS.LOG_HEIGHT,
        }
        // Recursively calls for the creation of the remaining logs
        return createLogRow(row)(col-1, logs.concat([newLog]));
      }
    },
    // Recursively calls for the creation of the remaining logs
    log1 = createLogRow(1),
    log2 = createLogRow(2),

    // Creates a row of turtle objects for row 5
    createTurtleRow:SingleRowCreator = (col:number, turtles:Body[]):Body[] => {
      // If col === 0, it returns an [] as it means there aren't any turtles 
      if (!col) {
        return turtles
      // If turtle objects > 0, it will create col amount of turtles in that specific row
      } else {
        const newTurtle: Body = {
          id: `TURTLE-${col}`,
          leftDirection: true,
          x: col*CONSTANTS.OBJECT_WIDTH, // Sets the spacing of each turtle group
          y: CONSTANTS.ROW_5,
          img: "../frogger/assets/turtles.png",
          width: CONSTANTS.TURTLE_WIDTH,
          height: CONSTANTS.TURTLE_HEIGHT,
        }
        // Recursively calls for the creation of the remaining turtles
        return createTurtleRow(col-1, turtles.concat([newTurtle]));
      }
    },
    // Creates a row of filled space objects for row 7
    // Used to display frog at target spaces
    createFilledSpaces:SingleRowCreator = (col:number, filledSpace:Body[]):Body[] => {
      // If col === 0, it returns an [] as it means there aren't any filled spaces 
      if (!col) {
        return filledSpace
      // If filled space objects > 0, it will create col amount of the object in that specific row
      } else {
        const newFilledSpace: Body = {
          id: `FILLED${col}`,
          leftDirection: false,
          x: (CONSTANTS.FROG_START_X - 6*CONSTANTS.FROG_STEP_X) + col*CONSTANTS.BUSH_WIDTH - CONSTANTS.BUSH_WIDTH, // Arithmetic progression to find the location of target spaces
          y: CONSTANTS.ROW_7,
          img: "../frogger/assets/frog.png", // Used to display frog in target spaces
          width: CONSTANTS.FROG_WIDTH,
          height: CONSTANTS.FROG_HEIGHT
        }
        // Recursively calls for the creation of the remaining filled spaces
        return createFilledSpaces(col-1, filledSpace.concat([newFilledSpace]));
      }
    },
  
    // Wraps the object in a torus so that when it moves out of the canvas, it'll loop back to the other side of the canvas
    wrap = (objectState:Body) => (left:boolean, speed:number):Body => {
      // Calculate the next x-coordinate to position the object
      const newX = objectState.x+speed
      // If the object moves from left to right, check whether it moves out at the right side of the canvas. If yes, then move it back to the left side of the canvas
      // Otherwise move it to the next position
      if (left) { 
        return {...objectState, 
        x:newX >= CONSTANTS.CANVAS_SIZE ? -objectState.width/2 : newX}
      // If the object moves from right to left, check whether it moves out at the right side of the canvas
      } else {
        return {...objectState, 
        x:newX <= -objectState.width ? CONSTANTS.CANVAS_SIZE-objectState.width/2 : newX}
      }
    },

    // Checks whether frog is on an object that's in the river
    onWaterObj = ([frog, object]:readonly [Frog, Body]):boolean => 
      // Checks whether the frog's x-coordinates are within the object's x-coordinates
      // Since the frog can move on the water object for 3 steps wide, use 3*CONSTANTS.FROG_STEP_X to find the width of water object safe for the frog to move on
      (frog.x >= object.x && frog.x < object.x + 3*CONSTANTS.FROG_STEP_X)
      // Ensure both frog and object are on the same y-axis 
      && (frog.y === object.y),

    // Checks whether frog is on a log within a state
    frogOnLog = (state: State):boolean => 
      // Checks all the logs to see which log the frog is on
      state.logs.filter((log:Body) => onWaterObj([state.frog, log]))
      // Filter will return an array with an element if the frog is on on the log, thus the array length is more than 0 and will return true
      // If there's an empty array, the array length is 0 and will return false. This means the frog is not on the log
      .length > 0,

    // Checks whether frog is on a turtle within a state
    frogOnTurtle = (state: State):boolean => 
      // Checks all the turtles to see which turtle the frog is on
      state.turtles.filter((turtle:Body) => onWaterObj([state.frog, turtle]))
      // Filter will return an array with an element if the frog is on on the log, thus the array length is more than 0 and will return true
      // If there's an empty array, the array length is 0 and will return false. This means the frog is not on the log
      .length > 0,

    // Calculates the x-ccordinate for convenience
    getXCoord = (num:number):number => CONSTANTS.FROG_START_X + num*CONSTANTS.FROG_STEP_X,

    // Checks whether the frog has collided with bushes near the target zones
    onBushes = (frog: Frog):boolean => 
      // Checks whether the frog is within the range of each bushes
      // If 75% of the frog is within the bush, it still counts as in the bush. Thus add/ minus CONSTANTS.FROG_WIDTH/4 from the either side of bush
      // Referring to the most left bush
      (frog.x + frog.width <= getXCoord(-3) + frog.width/4 
      && frog.x >= getXCoord(-5) - frog.width/4 || 
      // Referring to the 2nd most left bush
       frog.x + frog.width <= CONSTANTS.FROG_START_X + frog.width/4 
       && frog.x >= getXCoord(-2) - frog.width/4 || 
      // Referring to the 2nd most right bush
       frog.x + frog.width <= getXCoord(3) + frog.width/4 
       && frog.x >= getXCoord(1) - frog.width/4 || 
      // Referring to the most right bush
       frog.x + frog.width <=  getXCoord(6) + frog.width/4 
       && frog.x >=  getXCoord(4) - frog.width/4) 
      // Ensure the frog is on the same row as the bushes 
      && (frog.y === CONSTANTS.ROW_7),
    
    // Takes care of the various collisions that leads to a game over
    handleCollisions = (state:State):State => {

      const
        // Checks for collisions between the frog and obstacle (car)
        obstacleCollision = ([frog, obstacle]:readonly [Frog, Body]):boolean => 
        // Check for side collision on the frog's right side
        ((obstacle.x < frog.x + frog.width && frog.x < obstacle.x) 
        // Check for side collision on the frog's left side
        || (obstacle.x + obstacle.width > frog.x && frog.x + frog.width > obstacle.x + obstacle.width))
        // Ensure both frog and obstacle are on the same row
        && (frog.y === obstacle.y),

        // Checks all the cars whether a specific has collided with the frog or not
        frogCollided = state.cars.filter((car:Body) => obstacleCollision([state.frog, car])).length > 0,

        // Checks whether the frog is within the range of the river according to the rows
        onWater = (frog: Frog):boolean => frog.y >= CONSTANTS.ROW_6 && frog.y <= CONSTANTS.ROW_4,

        // Checks whether the half of the frog's body is out of the canvas on the left and right side
        // Only call when frog is on an water object
        unsafeBoundary = (frog: Frog):boolean => frog.x + frog.width/2 >= CONSTANTS.CANVAS_SIZE || frog.x + frog.width/2 <= 0,

        // Checks if the frog is either on a log or turtle
        frogOnObj = frogOnLog(state) || frogOnTurtle(state)
      return {
        ...state,
        // Triggers a game over if frog has collided with a car, is directly on water, touches the boundary when on a water object or
        // when it's on the bushes near the target
        gameOver: frogCollided || (onWater(state.frog) && !frogOnObj) || (frogOnObj && unsafeBoundary(state.frog)) || onBushes(state.frog)
      }
    },  
    
    // Initial game state when the game starts
    initialState:State = {
      frog: createFrog("FROG")("../frogger/assets/frog.png")([CONSTANTS.FROG_START_X, CONSTANTS.FROG_START_Y])([CONSTANTS.FROG_WIDTH, CONSTANTS.FROG_HEIGHT]),
      cars: car1(CONSTANTS.CAR_COUNT, []).concat(car2(CONSTANTS.CAR_COUNT, [])).concat(car3(CONSTANTS.CAR_COUNT, [])), // Concatenates all the cars in different rows to one array
      logs: log1(CONSTANTS.LOG_COUNT, []).concat(log2(CONSTANTS.LOG_COUNT, [])), // Concatenates all the logs in different rows to one array
      turtles: createTurtleRow(CONSTANTS.TURTLE_COUNT, []),
      filledSpaces: createFilledSpaces(CONSTANTS.TARGET_COUNT, []),
      filledSpacesIndex: [],
      score:0, 
      highscore:0, 
      level:0,
      gameOver: false,
    },
    
    // Create a boundary where the frog can't leave the canvas
    // Setting the left side boundary
    outLeftBound = (xPos:number):boolean => xPos < getXCoord(-6),
    // Setting the right side boundary
    outRightBound = (xPos:number):boolean => xPos >= getXCoord(7),
    // Setting the top boundary
    outUpBound = (yPos:number):boolean => yPos < CONSTANTS.ROW_7,
    // Setting the bottom boundary
    outDownBound = (yPos:number):boolean => yPos >= CONSTANTS.FROG_START_Y + CONSTANTS.FROG_STEP_Y,
    // Checks whether the frog's postiion is outside the boundary or not
    illegalMove = (xPos:number, yPos:number):boolean => {
      return outLeftBound(xPos) || outRightBound(xPos) || outUpBound(yPos) || outDownBound(yPos)
    },

    // Checks whether the frog is in the target area
    inTarget = (state:State):boolean => state.frog.y === CONSTANTS.ROW_7 && !onBushes(state.frog),

    // Updates the filled space index by checking whether the frog has landed in the target area or not
    updateFilledInd = (state:State):readonly number[] => {
      // Checks if the frog is in the target area or not. If yes, find the target area's index
      if (inTarget(state)){
        const 
          // Obtain the index of the target area
          targetIndex = Number(nearestObject(state).id[6]) - 1;
          // Firstly check whether the index is already in the array or not. If yes, concatenate an empty list
          // Otherwise, concatenate the unique index
          return state.filledSpacesIndex.concat(
            state.filledSpacesIndex.includes(targetIndex) ? [] : [targetIndex]);
      // If the frog isn't in the target area, continue with the current array
      } else {
        return state.filledSpacesIndex;
      }
    },

    // Checks whether the recent target area the frog landed has already been filled or not
    checkFilled = (state:State):boolean => {
      const 
        // Obtain the index of the target area
        targetIndex = Number(nearestObject(state).id[6]) - 1;
        // Checks if the target area index has that index or not
        return state.filledSpacesIndex.includes(targetIndex);
      },

    // Updates the score if the frog enters a unique target area
    updateScore = (state:State):number => {
      // Checks if the frog lands in a unique target area
      if (inTarget(state) && !checkFilled(state)){
        // If so, the player gets 100 points 
        return state.score + 100;
      // Otherwise no points earned
      } else {
        return state.score;
      }
    },

    // Updates the position of the frog according to the x and y-axis. Updates the movement of objects according to the game clock tick as well
    reduceState = (currentState:State, event: Move | Tick | Restart):State => {
      if (event instanceof Move) {
        const 
          // Calculate the next position of where the frog will head
          newX = currentState.frog.x + event.x,
          newY = currentState.frog.y + event.y;
        // Return a state with an updated position of the frog
        return {...currentState, frog: {
          ...currentState.frog, 
          // Checks whether the next position is out of the boundaries. If yes, remain in the same position. Otherwise move to the next position
          x:illegalMove(newX, CONSTANTS.FROG_START_Y)? currentState.frog.x : currentState.frog.x + event.x, 
          y:illegalMove(CONSTANTS.FROG_START_X, newY)? currentState.frog.y : currentState.frog.y + event.y}};
      // If the player wants to restart, return to the initial state but highscore isn't reseted
      } else if (event instanceof Restart) {
        return {
          ...currentState,
          frog: createFrog("FROG")("../frogger/assets/frog.png")([CONSTANTS.FROG_START_X, CONSTANTS.FROG_START_Y])([CONSTANTS.FROG_WIDTH, CONSTANTS.FROG_HEIGHT]),
          cars: car1(CONSTANTS.CAR_COUNT, []).concat(car2(CONSTANTS.CAR_COUNT, [])).concat(car3(CONSTANTS.CAR_COUNT, [])), // Concatenates all the cars in different rows to one array
          logs: log1(CONSTANTS.LOG_COUNT, []).concat(log2(CONSTANTS.LOG_COUNT, [])), // Concatenates all the logs in different rows to one array
          turtles: createTurtleRow(CONSTANTS.TURTLE_COUNT, []),
          filledSpaces: createFilledSpaces(CONSTANTS.TARGET_COUNT, []),
          filledSpacesIndex: [],
          score:0, 
          level: 0,
          gameOver: false,
        };
      // Head to where the game objects' behaviours are transformed based on in-game clock ticks
      } else {
        return tick(currentState);
      }
    },

    // Where the updates of object's behaviours happens based on the in-game clock ticks
    tick = (currentState:State):State => {
      // Calculates the speed multiplier to every level to make game harder
      const
        speedMultiplier = currentState.level*CONSTANTS.SPEED_INCREASE;
      // Checks if the gameover is triggered. If yes, return to the initial state without resetting the highscore
      if (currentState.gameOver) {
        return {
          ...currentState,
          frog: createFrog("FROG")("../frogger/assets/frog.png")([CONSTANTS.FROG_START_X, CONSTANTS.FROG_START_Y])([CONSTANTS.FROG_WIDTH, CONSTANTS.FROG_HEIGHT]),
          cars: car1(CONSTANTS.CAR_COUNT, []).concat(car2(CONSTANTS.CAR_COUNT, [])).concat(car3(CONSTANTS.CAR_COUNT, [])), // Concatenates all the cars in different rows to one array
          logs: log1(CONSTANTS.LOG_COUNT, []).concat(log2(CONSTANTS.LOG_COUNT, [])), // Concatenates all the logs in different rows to one array
          turtles: createTurtleRow(CONSTANTS.TURTLE_COUNT, []),
          filledSpaces: createFilledSpaces(CONSTANTS.TARGET_COUNT, []),
          filledSpacesIndex: [],
          score:0, 
          level: 0,
          gameOver: false,
        };
      // Since the player hasn't trigger the gameover, check if the target area has not been fully filled
      } else if (currentState.filledSpacesIndex.length < 5) {
      // Updates the game state and taking account in the collisions of the frog that will trigger a game over
      return handleCollisions({
        ...currentState, 

        // Updates each car's movement according to their row and speed multiplier
        cars:currentState.cars.map((carState:Body) => {
          // Allows the car to be looped back one it exits the canvas
          const carWrap = wrap(carState);
          // If the car moves from left to right, set the speed to car2's
          if (carState.leftDirection) {
            return carWrap(true, CONSTANTS.CAR2_SPEED + speedMultiplier);
          // Since the cars in the other 2 rows move from right to left, check if it's the 3rd row of cars.
          // If yes, set the speed to car3's
          } else if (carState.id[3] === "3") {
            return carWrap(false, CONSTANTS.CAR3_SPEED - speedMultiplier);
          // Set the speed of the cars in the first row to car1's
          } else {
            return carWrap(false, CONSTANTS.CAR1_SPEED - speedMultiplier);
        }}),

        // Updates each log's movement according to their row and speed multiplier
        logs:currentState.logs.map((logState:Body) => {
          // Allows the log to be looped back one it exits the canvas
          const logWrap = wrap(logState);
          // Since the logs in both rows move from left to right, check if it's the 2nd row of logs.
          // If yes, set the speed to log2's
          if (logState.id[3] === "2") {
            return logWrap(true, CONSTANTS.LOG2_SPEED + speedMultiplier);
          // Set the speed of the logs in the first row of logs to log1's
          } else {
            return logWrap(true, CONSTANTS.LOG1_SPEED + speedMultiplier);
          }
        }),

        // Updates each turtle's movement according to their row and speed multiplier
        turtles:currentState.turtles.map((turtleState:Body) => {
          // Allows the turtle group to be looped back one it exits the canvas
          const turtleWrap = wrap(turtleState);
          // Set the speed of the turtles 
          return turtleWrap(false, CONSTANTS.TURTLE_SPEED - speedMultiplier);
        }),

        // Update the new score
        score: updateScore(currentState), 
        // Updates the highscore by checking whether score is higher than highscore
        highscore:currentState.highscore <= currentState.score ? currentState.score : currentState.highscore, 

        // Check whether the frog is in the target area. If yes, set the frog back to the starting position.
        frog:inTarget(currentState) ? initialState.frog : 
        // Otherwise it means it's not in the target area and check whether it's on a 1st log row or not
        // If yes, set the frog's speed to log1's 
        (frogOnLog(currentState) && currentState.frog.y === currentState.logs[0].y) ? 
        {...currentState.frog, x:currentState.frog.x + (CONSTANTS.LOG1_SPEED + speedMultiplier)}
        // Otherwise check whether frog is on a 2nd log row or not.
        // If yes, set the frog's speed to log2's
        : (frogOnLog(currentState) && currentState.frog.y === currentState.logs[3].y)? 
        {...currentState.frog, x:currentState.frog.x + (CONSTANTS.LOG2_SPEED + speedMultiplier)}
        // Otherwise check whether frog is on a turtle or not.
        // If yes, set the frog's speed same to the turtles
        : (frogOnTurtle(currentState) && currentState.frog.y === currentState.turtles[0].y)? 
        {...currentState.frog, x:currentState.frog.x + (CONSTANTS.TURTLE_SPEED - speedMultiplier)}
        // Otherwise don't set the frog's speed 
        : currentState.frog,

        // Updates the target area index where the frog has filled
        filledSpacesIndex: updateFilledInd(currentState),
      });
    // Otherwise, we reset the target areas filled back to empty when the frog has filled up all target areas
    } else {
      // Updates the game state and taking account in the collisions of the frog that will trigger a game over
      return  handleCollisions({
        ...currentState, 

        // Increments the level by 1 when all 5 target areas are filled up
        level: currentState.level + 1,

        // Updates each car's movement according to their row and speed multiplier
        cars:currentState.cars.map((carState:Body) => {
          // Allows the car to be looped back one it exits the canvas
          const carWrap = wrap(carState);
          // If the car moves from left to right, set the speed to car2's
          if (carState.leftDirection) {
            return carWrap(true, CONSTANTS.CAR2_SPEED + speedMultiplier);
          // Since the cars in the other 2 rows move from right to left, check if it's the 3rd row of cars.
          // If yes, set the speed to car3's
          } else if (carState.id[3] === "3") {
            return carWrap(false, CONSTANTS.CAR3_SPEED - speedMultiplier);
          // Set the speed of the cars in the first row to car1's
          } else {
            return carWrap(false, CONSTANTS.CAR1_SPEED - speedMultiplier);
        }}),

        // Updates each log's movement according to their row and speed multiplier
        logs:currentState.logs.map((logState:Body) => {
          // Allows the log to be looped back one it exits the canvas
          const logWrap = wrap(logState);
          // Since the logs in both rows move from left to right, check if it's the 2nd row of logs.
          // If yes, set the speed to log2's
          if (logState.id[3] === "2") {
            return logWrap(true, CONSTANTS.LOG2_SPEED + speedMultiplier);
          // Set the speed of the logs in the first row of logs to log1's
          } else {
            return logWrap(true, CONSTANTS.LOG1_SPEED + speedMultiplier);
          }
        }),

        // Updates each turtle's movement according to their row and speed multiplier
        turtles:currentState.turtles.map((turtleState:Body) => {
          // Allows the turtle group to be looped back one it exits the canvas
          const turtleWrap = wrap(turtleState);
          // Set the speed of the turtles 
          return turtleWrap(false, CONSTANTS.TURTLE_SPEED - speedMultiplier);
        }),

        // Update the new score
        score: updateScore(currentState), 
        // Updates the highscore by checking whether score is higher than highscore
        highscore:currentState.highscore <= currentState.score ? currentState.score : currentState.highscore, 

        // Check whether the frog is in the target area. If yes, set the frog back to the starting position.
        frog:inTarget(currentState) ? initialState.frog : 
        // Otherwise it means it's not in the target area and check whether it's on a 1st log row or not
        // If yes, set the frog's speed to log1's
        (frogOnLog(currentState) && currentState.frog.y === currentState.logs[0].y) ? 
        {...currentState.frog, x:currentState.frog.x + (CONSTANTS.LOG1_SPEED + speedMultiplier)}
        // Otherwise check whether frog is on a 2nd log row or not.
        // If yes, set the frog's speed to log2's
        : (frogOnLog(currentState) && currentState.frog.y === currentState.logs[3].y) ? 
        {...currentState.frog, x:currentState.frog.x + (CONSTANTS.LOG2_SPEED + speedMultiplier)}
        // Otherwise check whether frog is on a turtle or not.
        // If yes, set the frog's speed same to the turtles
        : (frogOnTurtle(currentState) && currentState.frog.y === currentState.turtles[0].y) ? 
        {...currentState.frog, x:currentState.frog.x + (CONSTANTS.TURTLE_SPEED - speedMultiplier)}
        // Otherwise don't set the frog's speed 
        : currentState.frog,

        // Updates the target area index to an empty array to represent no target area is filled 
        filledSpacesIndex: [],
      });
    }};
    
    // Where the main observables are tied in and executed 
    merge(moveLeft$, moveRight$, moveUp$, moveDown$, restart$, tick$).pipe(
      scan(reduceState, initialState)
    ).subscribe(updateView);
  
    // Helps find which target area did the frog land
    // Use each target areas' x-coordinates and compare them with the frog's location
    // Returns the nearest target area
    const nearestObject = (state:State):Body => state.filledSpaces.reduce(
      (acc:Body, object:Body) => (Math.abs(object.x - state.frog.x) < Math.abs(acc.x - state.frog.x) ? object : acc)
    ),

  // THE IMPURE FUNCTIONS (ALL FUNCTIONS HERE ARE IMPURE)
  // Set multiple attributes of the element 
  setMultipleAttributes = (body:Element, attr:object) => {
    Object.keys(attr).forEach((key) => body.setAttribute(key, String(attr[key as keyof {}])))
  },

  // Updates the attributes for the body objects
  updateBody = (canvas:HTMLElement, objectState:Body) => {
    // Obtain the element by locating its ID
    const object = document.getElementById(objectState.id);
    // If object doesn't exist, create an image element
    if (!object) {
      const newObject = document.createElementNS(canvas.namespaceURI, "image");
      // Set their respective attributes
      setMultipleAttributes(newObject, 
      {id: objectState.id, href: objectState.img, width: objectState.width, height: objectState.height, x: objectState.x, y: objectState.y});
      // Append them into the canvas to view it
      canvas.appendChild(newObject);
    // Otherwise, update the element position if it exists
    } else {
      setMultipleAttributes(object, {x: objectState.x, y: objectState.y});
    }
  },

  // Changes the visibility of the SVG images of frogs in the target area
  changeVisibility = (num:number, status:string) => {
    // Obtain the right SVG image of the frog in the target area
    const objElem = document.getElementById("FILLED"+String(num))!;
    // Set its visibility status to either visible or hidden
    objElem.setAttribute("visibility", status)
  };

  // Updates svg in the HTML to make game animated 
  function updateView(state:State){
    const canvas = document.getElementById("svgCanvas")!;
    // Update each cars svg in the HTML
    state.cars.forEach((carState:Body) => {
      updateBody(canvas, carState);
    })
    // Update each logs svg in the HTML
    state.logs.forEach((logState:Body) => {
      updateBody(canvas, logState);
    })
    // Update each turtles svg in the HTML
    state.turtles.forEach((turtleState:Body) => {
      updateBody(canvas, turtleState);
    })
    // Update the frog svg in the HTML
    // Obtain the element by locating its ID
    const frog = document.getElementById(state.frog.id);
    // If frog doesn't exist, create an image element
    if (!frog) {
      const newFrog = document.createElementNS(canvas.namespaceURI, "image");
      // Set the frog's respective attributes
      setMultipleAttributes(newFrog, 
      {id: state.frog.id, href: state.frog.img, width: state.frog.width, height: state.frog.height, x: state.frog.x, y: state.frog.y});
      // Append the frog into the canvas to view it
      canvas.appendChild(newFrog);
    // Otherwise, update the element position if it exists
    } else {
      setMultipleAttributes(frog, 
      {x: state.frog.x, y: state.frog.y});
    };
    // Check if any target has been filled yet or not
    if (state.filledSpacesIndex.length > 0 && state.filledSpacesIndex.length < CONSTANTS.TARGET_COUNT){
      // If yes, we made that specific SVG image of the frog visible
      state.filledSpacesIndex.forEach((obj:number) => changeVisibility(obj, "visible"));
    // If all slots are filled or no target is filled, hide the SVG images of the frog
    } else {
      CONSTANTS.TARGET_INDEX.forEach((obj:number) => changeVisibility(obj, "hidden"));
    }
    // Obtain the score element
    const score = document.getElementById("SCORE")!;
    // Update the score 
    score.textContent = `SCORE: ${state.score}`;
    // Obtain the highscore element
    const highscore = document.getElementById("HIGHSCORE")!;
    // Update the highscore 
    highscore.textContent = `HIGHSCORE: ${state.highscore }`;
  };
  // The event type containing keydown and keyup for the bottom observable
  type Event = 'keydown' | 'keyup';

  // Highlights the key whenever the player presses the key
  function highlight() {
    // Listens for specific key presses and highlights when the key is pressed
    function highlightKey(key:Key) {
      const keyButton = document.getElementById(key)!,
        keyboardObs$ = (e:Event) => fromEvent<KeyboardEvent>(document, String(e)).pipe(
          filter(({code})=>code === key))
      // Subscribe the observable and it will highlight when the specific key is pressed
      keyboardObs$('keydown').subscribe(_ => keyButton.classList.add("highlight"))
      // Subscribe the observable and the highlight will be removed when the specific key is released
      keyboardObs$('keyup').subscribe(_=>keyButton.classList.remove("highlight"))
    }
    // The specific keys that will highlight when they are pressed
    highlightKey('KeyA');
    highlightKey('KeyD');
    highlightKey('KeyS');
    highlightKey('KeyW');
    highlightKey('Enter');
  }
  // Have a 100ms interval between each highlight
  interval(CONSTANTS.TICK).subscribe(highlight)
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}

