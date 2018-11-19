class Player {


    spriterData = new spriter.Data().load(JSON.parse(text));
    spriterPose = new spriter.Pose(spriterData);

    constructor() {
        this.x = 42;
        this.y = 3.14;
    }

}

const player = new Player();
