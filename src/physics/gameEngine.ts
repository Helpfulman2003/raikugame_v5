import Matter from 'matter-js';

const { Engine, Render, Runner, World, Bodies, Constraint, Mouse, MouseConstraint, Events, Vector } = Matter;

interface GameEngineOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  onScoreEvent: (points: number) => void;
  onLevelComplete: (didWin: boolean, nextLevelExists: boolean) => void;
  onBirdConsumed: (birdsMelt: number) => void;
}

const LEVELS = [
    {
        // Level 1
        blocks: [
            { x: 650, y: 710, w: 20, h: 100 },
            { x: 750, y: 710, w: 20, h: 100 },
            { x: 700, y: 650, w: 140, h: 20 }
        ],
        pigs: [
            { x: 700, y: 740, r: 20 }
        ],
        birdsTotal: 3
    },
    {
        // Level 2
        blocks: [
            // Cụm trái
            { x: 550, y: 710, w: 20, h: 100 },
            { x: 650, y: 710, w: 20, h: 100 },
            { x: 600, y: 650, w: 140, h: 20 },
            // Cụm phải
            { x: 750, y: 710, w: 20, h: 100 },
            { x: 850, y: 710, w: 20, h: 100 },
            { x: 800, y: 650, w: 140, h: 20 },
            // Khuếch nối ở trên
            { x: 650, y: 590, w: 20, h: 100 },
            { x: 750, y: 590, w: 20, h: 100 },
            { x: 700, y: 530, w: 140, h: 20 }
        ],
        pigs: [
            { x: 600, y: 740, r: 20 },
            { x: 800, y: 740, r: 20 },
            { x: 700, y: 500, r: 20 } 
        ],
        birdsTotal: 4
    },
    {
        // Level 3 (Big Castle)
        blocks: [
            // Left structure (shifted left to x=575 to avoid overlap)
            { x: 525, y: 710, w: 20, h: 100 },
            { x: 625, y: 710, w: 20, h: 100 },
            { x: 575, y: 650, w: 140, h: 20 },
            
            // Right structure (shifted right to x=875 to avoid overlap)
            { x: 825, y: 710, w: 20, h: 100 },
            { x: 925, y: 710, w: 20, h: 100 },
            { x: 875, y: 650, w: 140, h: 20 },
            
            // Middle section (unmoved, x=725)
            { x: 675, y: 710, w: 20, h: 100 },
            { x: 775, y: 710, w: 20, h: 100 },
            { x: 725, y: 650, w: 140, h: 20 },
            
            // Center High Tower
            { x: 675, y: 590, w: 20, h: 100 },
            { x: 775, y: 590, w: 20, h: 100 },
            { x: 725, y: 530, w: 140, h: 20 },

            { x: 700, y: 470, w: 20, h: 100 },
            { x: 750, y: 470, w: 20, h: 100 },
            { x: 725, y: 410, w: 80, h: 20 }
        ],
        pigs: [
            { x: 575, y: 740, r: 20 },
            { x: 875, y: 740, r: 20 },
            { x: 725, y: 740, r: 20 },
            { x: 725, y: 620, r: 20 },
            { x: 725, y: 500, r: 20 }
        ],
        birdsTotal: 5
    }
];

export class GameEngine {
  engine: Matter.Engine;
  render: Matter.Render;
  runner: Matter.Runner;
  mouseConstraint: Matter.MouseConstraint;
  
  slingshotAnchor = { x: 250, y: 550 };
  birdConstraint: Matter.Constraint | null = null;
  currentBird: Matter.Body | null = null;
  blocks: Matter.Body[] = [];
  pigs: Matter.Body[] = [];
  
  options: GameEngineOptions;
  hasFired = false;
  score = 0;
  currentLevelIndex = 0;
  birdsLeft = 3;
  levelTimer: NodeJS.Timeout | null = null;
  raikuImage: HTMLImageElement;
  
  constructor(options: GameEngineOptions) {
    this.options = options;
    
    this.raikuImage = new window.Image();
    this.raikuImage.src = '/assets/raiku.png';
    
    this.engine = Engine.create({
      positionIterations: 8,
      velocityIterations: 8,
    });
    
    this.render = Render.create({
      canvas: options.canvas,
      engine: this.engine,
      options: {
        width: options.width,
        height: options.height,
        background: 'transparent',
        wireframes: false,
      }
    });
    
    const mouse = Mouse.create(this.render.canvas);
    this.mouseConstraint = MouseConstraint.create(this.engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.1,
        render: { visible: false }
      },
      collisionFilter: {
          mask: 0x0002 // CHỈ cho phép chuột tương tác với vật thể thuộc nhóm 0x0002 (Chim khi chưa bắn)
      }
    });

    if (this.render.canvas) {
        const bounds = this.render.canvas.getBoundingClientRect();
        Mouse.setScale(mouse, { 
            x: this.render.canvas.width / bounds.width, 
            y: this.render.canvas.height / bounds.height 
        });
    }

    World.add(this.engine.world, this.mouseConstraint);
    this.render.mouse = mouse;
    
    Events.on(this.engine, 'beforeUpdate', () => {
        if (this.currentBird && !this.hasFired && this.birdConstraint) {
            const dist = Vector.magnitude(Vector.sub(this.currentBird.position, this.slingshotAnchor));
            const isMouseDown = this.mouseConstraint.mouse.button !== -1;
            
            if (dist > 30 && !isMouseDown) {
                // Shoot with manual velocity
                const pullDistance = Vector.sub(this.slingshotAnchor, this.currentBird.position);
                World.remove(this.engine.world, this.birdConstraint);
                this.birdConstraint = null;

                Matter.Body.setVelocity(this.currentBird, {
                     x: pullDistance.x * 0.14, // Tăng lực bay của chim thêm một chút
                     y: pullDistance.y * 0.14
                });
                
                // Khóa không cho chuột gắp con chim này nữa bằng cách đổi Category
                this.currentBird.collisionFilter.category = 0x0001; 
                
                this.fireBird();
            }
        }
    });

    Events.on(this.engine, 'collisionStart', (event: Matter.IEventCollision<Matter.Engine>) => {
      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;
        
        const relVel = Vector.sub(bodyA.velocity, bodyB.velocity);
        const impact = Vector.magnitude(relVel);
        
        if (impact > 3) {
           this.handleImpact(bodyA, impact);
           this.handleImpact(bodyB, impact);
        }
      }
    });

    // Cyberpunk Neon Custom Render Loop!
    Events.on(this.render, 'afterRender', () => {
        const context = this.render.context;
        
        // Draw Blocks
        this.blocks.forEach(block => {
            const blockAny = block as any;
            const w = blockAny.originalW || (block.bounds.max.x - block.bounds.min.x);
            const h = blockAny.originalH || (block.bounds.max.y - block.bounds.min.y);
            this.drawNeonRect(context, block.position.x, block.position.y, w, h, block.angle, '#00FFFF', '#007788');
        });

        // Draw Cyberpunk Pigs (Màu Hồng)
        this.pigs.forEach(pig => {
            this.drawNeonCircle(context, pig, pig.circleRadius || 20, '#FF2E63', '#990022');
        });

        // Draw Raiku Bird
        if (this.currentBird) {
            context.translate(this.currentBird.position.x, this.currentBird.position.y);
            context.rotate(this.currentBird.angle);
            context.shadowBlur = 15;
            context.shadowColor = '#39FF14';
            context.drawImage(this.raikuImage, -25, -25, 50, 50);
            context.shadowBlur = 0;
            context.rotate(-this.currentBird.angle);
            context.translate(-this.currentBird.position.x, -this.currentBird.position.y);
        }

        // Draw Energy Slingshot constraint
        if (this.birdConstraint && this.currentBird && !this.hasFired) {
             context.beginPath();
             context.moveTo(this.slingshotAnchor.x, this.slingshotAnchor.y);
             context.lineTo(this.currentBird.position.x, this.currentBird.position.y);
             context.strokeStyle = '#39FF14';
             context.lineWidth = 4;
             context.setLineDash([5, 5]);
             context.stroke();
             context.setLineDash([]);
             context.shadowBlur = 10;
             context.shadowColor = '#39FF14';
             context.stroke();
             context.shadowBlur = 0;
        }

        // Draw waiting birds to show "lives" left (Màu Xanh Neon)
        for (let i = 0; i < this.birdsLeft; i++) {
            const bx = 180 - (i * 45); 
            const by = 745; 
            const radius = 15; 

            context.translate(bx, by);
            context.shadowBlur = 10;
            context.shadowColor = '#39FF14';
            context.drawImage(this.raikuImage, -radius, -radius, radius * 2, radius * 2);
            context.shadowBlur = 0;
            context.translate(-bx, -by);
        }
    });

    this.runner = Runner.create();
  }

  drawNeonRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, color: string, bgColor: string) {
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      // Glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-w/2, -h/2, w, h);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.rotate(-angle);
      ctx.translate(-x, -y);
  }

  drawNeonCircle(ctx: CanvasRenderingContext2D, body: Matter.Body, radius: number, color: string, bgColor: string) {
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Inner tech lines
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.5, 0, Math.PI);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.rotate(-body.angle);
      ctx.translate(-body.position.x, -body.position.y);
  }

  start(levelIdx: number) {
    this.currentLevelIndex = levelIdx;
    this.score = 0;
    this.options.onScoreEvent(0); // Trigger reset update
    this.setupLevel();
    Render.run(this.render);
    Runner.run(this.runner, this.engine);
  }

  stop() {
    Render.stop(this.render);
    Runner.stop(this.runner);
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }

  setupLevel() {
    if (this.levelTimer) clearTimeout(this.levelTimer);
    World.clear(this.engine.world, false);
    
    // Ground
    const ground = Bodies.rectangle(this.options.width / 2, this.options.height + 40, this.options.width * 2, 160, { 
      isStatic: true, 
      friction: 1,
      render: { visible: false } 
    });
    
    // Tường bao (Tường phải đẩy tít ra xa để chim bay ra khỏi màn hình không bị kẹt)
    const wallLeft = Bodies.rectangle(-50, this.options.height / 2, 100, this.options.height, { isStatic: true });
    const wallRight = Bodies.rectangle(5000, this.options.height / 2, 100, this.options.height, { isStatic: true });
    
    World.add(this.engine.world, [ground, wallLeft, wallRight, this.mouseConstraint]);
    
    this.birdsLeft = LEVELS[this.currentLevelIndex].birdsTotal;
    this.options.onBirdConsumed(this.birdsLeft);
    this.spawnBird();
    this.buildCastle();
    
    this.hasFired = false;
  }

  spawnBird() {
    if (this.birdsLeft <= 0) return;
    
    const startPos = { x: this.slingshotAnchor.x, y: this.slingshotAnchor.y };
    this.currentBird = Bodies.circle(startPos.x, startPos.y, 25, {
      restitution: 0.4, // Giảm nảy
      density: 0.02, // Chim vô cùng nặng (gấp 4 lần cũ), đúc bằng kẽm để xuyên thủng gạch mượt mà
      frictionAir: 0.01,
      label: 'Bird',
      collisionFilter: { category: 0x0002 }, // Gán nhãn 0x0002 để chuột có thể gắp
      render: { visible: false } 
    });

    this.birdConstraint = Constraint.create({
      pointA: this.slingshotAnchor,
      bodyB: this.currentBird,
      pointB: { x: 0, y: 0 },
      stiffness: 0.05,
      length: 10,
      render: { visible: false }
    });

    World.add(this.engine.world, [this.currentBird, this.birdConstraint]);
    this.hasFired = false;
    this.birdsLeft--;
    this.options.onBirdConsumed(this.birdsLeft);
  }

  fireBird() {
    if (this.hasFired) return;
    this.hasFired = true;
    
    this.levelTimer = setTimeout(() => {
        this.checkWinConditions();
    }, 3500); // Giảm thời gian chờ xuất hiện chim mới từ 6 giây xuống 3.5 giây
  }

  checkWinConditions() {
      if (this.pigs.length === 0) {
          const hasNext = this.currentLevelIndex + 1 < LEVELS.length;
          this.options.onLevelComplete(true, hasNext);
      } else {
          if (this.birdsLeft > 0) {
              this.spawnBird();
          } else {
              this.options.onLevelComplete(false, true); 
          }
      }
  }

  buildCastle() {
    this.blocks = [];
    this.pigs = [];
    const levelConfig = LEVELS[this.currentLevelIndex];
    
    levelConfig.blocks.forEach(b => this.addBlock(b.x, b.y, b.w, b.h));
    levelConfig.pigs.forEach(p => this.addPig(p.x, p.y, p.r));
  }

  addBlock(x: number, y: number, w: number, h: number) {
      const block = Bodies.rectangle(x, y, w, h, {
          label: 'Block',
          density: 0.002,
          restitution: 0.2,  // Thêm đàn hồi nhẹ cho gỗ
          render: { visible: false }
      });
      (block as any).health = 4; // Giảm máu gỗ từ 8 xuống 4 để siêu dễ vỡ
      (block as any).originalW = w; // Lưu kích thước thật để fix lỗi render biến đổi hình dạng AABB
      (block as any).originalH = h;
      this.blocks.push(block);
      World.add(this.engine.world, block);
  }

  addPig(x: number, y: number, r: number) {
      const pig = Bodies.circle(x, y, r, {
          label: 'Pig',
          density: 0.001,
          restitution: 0.6,
          render: { visible: false } 
      });
      (pig as any).health = 6; // Giảm xuống 6 để lợn dễ bị đập vỡ hơn
      this.pigs.push(pig);
      World.add(this.engine.world, pig);
  }

  handleImpact(body: Matter.Body, impact: number) {
      if ((body.label === 'Block' || body.label === 'Pig')) {
          const bodyAsAny = body as any;
          if (bodyAsAny.health !== undefined) {
              bodyAsAny.health -= impact;
              if (bodyAsAny.health <= 0) {
                  this.destroyBody(body);
              }
          }
      }
  }

  destroyBody(body: Matter.Body) {
      World.remove(this.engine.world, body);
      if (body.label === 'Pig') {
          this.pigs = this.pigs.filter(p => p !== body);
          this.score += 100;
          this.options.onScoreEvent(100);
          
          if (this.pigs.length === 0) {
              if (this.levelTimer) clearTimeout(this.levelTimer);
              setTimeout(() => {
                  const hasNext = this.currentLevelIndex + 1 < LEVELS.length;
                  this.options.onLevelComplete(true, hasNext);
              }, 1500); 
          }
      } else if (body.label === 'Block') {
          this.blocks = this.blocks.filter(b => b !== body);
          this.score += 10;
          this.options.onScoreEvent(10);
      }
  }

  resetLevel() {
      this.score = 0;
      this.options.onScoreEvent(0);
      this.setupLevel();
  }
}
