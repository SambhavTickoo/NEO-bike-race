import Matter from 'matter-js';
import { PHYSICS_CONFIG, BIKE_TYPES } from '../constants';

export class Bike {
  public body: Matter.Body;
  public wheelA: Matter.Body;
  public wheelB: Matter.Body;
  public composite: Matter.Composite;
  public isLocal: boolean;
  public color: string;
  public settings: any;

  constructor(world: Matter.World, x: number, y: number, type: string = 'STANDARD', isLocal: boolean = false) {
    this.isLocal = isLocal;
    this.settings = (BIKE_TYPES as any)[type] || BIKE_TYPES.STANDARD;
    this.color = this.settings.color;

    const scale = this.settings.scale;

    // Create bike frame with a lower center of mass
    this.body = Matter.Bodies.rectangle(x, y, 60 * scale, 20 * scale, {
      collisionFilter: { group: -1 },
      chamfer: { radius: 5 },
      label: 'bike-frame',
      density: this.settings.weight
    });

    // Lower the center of gravity manually by shifting the wheels up relative to frame
    // or frame down relative to wheels.
    // In Matter.js, we can also just adjust the mass center if needed, 
    // but better positioning works too.

    // Create wheels
    this.wheelA = Matter.Bodies.circle(x - 25 * scale, y + 22 * scale, 16 * scale, { // Slightly larger wheels for stability
      friction: PHYSICS_CONFIG.wheelFriction,
      restitution: PHYSICS_CONFIG.wheelRestitution,
      collisionFilter: { group: -1 },
      label: 'wheel-back',
    });

    this.wheelB = Matter.Bodies.circle(x + 25 * scale, y + 22 * scale, 16 * scale, {
      friction: PHYSICS_CONFIG.wheelFriction,
      restitution: PHYSICS_CONFIG.wheelRestitution,
      collisionFilter: { group: -1 },
      label: 'wheel-front',
    });

    // Axles
    const constraintA = Matter.Constraint.create({
      bodyA: this.body,
      pointA: { x: -25 * scale, y: 12 * scale },
      bodyB: this.wheelA,
      stiffness: 0.3, // Stiffer suspension
      length: 0,
      render: { visible: false }
    });

    const constraintB = Matter.Constraint.create({
      bodyA: this.body,
      pointA: { x: 25 * scale, y: 12 * scale },
      bodyB: this.wheelB,
      stiffness: 0.3,
      length: 0,
      render: { visible: false }
    });

    this.composite = Matter.Composite.create({
      bodies: [this.body, this.wheelA, this.wheelB],
      constraints: [constraintA, constraintB]
    });

    Matter.World.add(world, this.composite);
  }

  update(inputs: { forward: boolean; backward: boolean; left: boolean; right: boolean }) {
    if (!this.isLocal) return;

    const grounded = this.isGrounded();
    
    // Driving
    if (inputs.forward) {
      if (grounded) {
        // Forward force + wheel torque for better grip without instant wheelies
        Matter.Body.applyForce(this.body, this.body.position, { x: 0.004 * this.settings.speed * 10, y: 0 });
        Matter.Body.setAngularVelocity(this.wheelA, this.wheelA.angularVelocity + this.settings.speed);
        Matter.Body.setAngularVelocity(this.wheelB, this.wheelB.angularVelocity + this.settings.speed);
      }
    }
    if (inputs.backward) {
      if (grounded) {
        Matter.Body.applyForce(this.body, this.body.position, { x: -0.002 * this.settings.speed * 10, y: 0 });
        Matter.Body.setAngularVelocity(this.wheelA, this.wheelA.angularVelocity - this.settings.speed / 2);
        Matter.Body.setAngularVelocity(this.wheelB, this.wheelB.angularVelocity - this.settings.speed / 2);
      }
    }

    // Tilting
    if (inputs.left) { // Tilt Left (Up Arrow)
      Matter.Body.setAngularVelocity(this.body, this.body.angularVelocity - (grounded ? 0.02 : PHYSICS_CONFIG.airRotationSpeed));
    }
    if (inputs.right) { // Tilt Right (Down Arrow)
      Matter.Body.setAngularVelocity(this.body, this.body.angularVelocity + (grounded ? 0.02 : PHYSICS_CONFIG.airRotationSpeed));
    }
  }

  isGrounded() {
    return Math.abs(this.wheelA.velocity.y) < 0.2 || Math.abs(this.wheelB.velocity.y) < 0.2;
  }

  // Used for updating ghost/remote players
  sync(data: { x: number; y: number; rotation: number }) {
    Matter.Body.setPosition(this.body, { x: data.x, y: data.y });
    Matter.Body.setAngle(this.body, data.rotation);
  }

  destroy(world: Matter.World) {
    Matter.World.remove(world, this.composite);
  }
}
