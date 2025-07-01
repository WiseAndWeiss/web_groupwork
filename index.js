import {CONSTS,CONFIGS} from './defs.js';
let raycaster = new THREE.Raycaster();
let pointer = new THREE.Vector2();
let currentCamera;
let scene,renderer;
let objects = [];
let sun,earth,moon;
let controls;
let focusedObject;
let originalTarget = new THREE.Vector3(); // 原始目标：原点
let cameraOffset = new THREE.Vector3();
let originalDistance = 0;
let isUserInteracting = false;
let lastUpdateTime = 0;

//相机参数
const fov = 75; //摄像机的广角(角度制，Three.js其他部分都是弧度制)
const aspect = (window.innerWidth / window.innerHeight);  // 宽高比
const near = 0.1; //可绘区域的近点
const far = 1000; //可绘区域的远点
//自由相机的初始化
const freeCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
freeCamera.position.set(0, 0, 150);
//垂直相机的初始化
const verticalCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
verticalCamera.position.set(0, 150, 0);
verticalCamera.up.set(0, 0, 1);
verticalCamera.lookAt(0, 0, 0);
//水平相机的初始化
const horizontalCamera = new THREE.PerspectiveCamera(fov,aspect,near,far);
horizontalCamera.position.set(0, 0, 150);

currentCamera = freeCamera;

function init() {
    //1.初始化操作；包括场景渲染器的初始化
    //场景的初始化
    scene = new THREE.Scene();

    //渲染器的初始化
    const canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({antialias: true, canvas});
    renderer.setSize(window.innerWidth,window.innerHeight);

    //2.添加光源：以太阳为中心的点光源
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 2);//光照的颜色和亮度
    scene.add(pointLight);

    //3.添加地球、太阳、月球
    const textureLoader = new THREE.TextureLoader();
    //添加太阳
    const sunGeometry = new THREE.SphereGeometry(CONSTS.SUN_RADIUS,CONSTS.SPHERE_SEGS,CONSTS.SPHERE_SEGS);
    const sunTexture = textureLoader.load('./texture/sun.jpg');
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
    sun = new THREE.Mesh(sunGeometry,sunMaterial);
    scene.add(sun);//太阳直接位于正中间
    //添加地球
    const earthGeometry = new THREE.SphereGeometry(CONSTS.EARTH_RADIUS, CONSTS.SPHERE_SEGS, CONSTS.SPHERE_SEGS); //几何体：球体，参数为半径、经度分段、纬度分段 
    const earthTexture = textureLoader.load('./texture/earth.jpg');  //加载材质     
    const earthMaterial = new THREE.MeshPhongMaterial({ map: earthTexture }); //设置材质和放射颜色
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    //添加地球轨道(用于公转操作)
    const earthOrbitGeometry = 
        new THREE.TorusGeometry(CONSTS.EARTH_ORBIT_RADIUS, CONSTS.ORBIT_WIDTH, CONSTS.TORUS_SEGS, CONSTS.TORUS_SEGS);
    const OrbitMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
    const earthOrbit = new THREE.Mesh(earthOrbitGeometry,OrbitMaterial);
    earthOrbit.rotation.x = Math.PI / 2;
    scene.add(earthOrbit); 
    //添加地月系统(需要保证地球公转和自转相互不干扰，必须设置这样的系统)
    const earthSystem = new THREE.Object3D();
    earthOrbit.add(earthSystem);
    earthSystem.position.x = CONSTS.EARTH_ORBIT_RADIUS;
    earthSystem.add(earth);
    //添加月球轨道
    const moonOrbitGeometry = 
        new THREE.TorusGeometry(CONSTS.MOON_ORBIT_RADIUS, CONSTS.ORBIT_WIDTH, CONSTS.TORUS_SEGS, CONSTS.TORUS_SEGS);
    const moonOrbit = new THREE.Mesh(moonOrbitGeometry,OrbitMaterial);
    moonOrbit.rotation.z = Math.PI / 2; // 关键修改：绕X轴旋转90度
    earthSystem.add(moonOrbit);
    //moonOrbit.position.x = 0;轨道中心在地月系统的中心
    //添加月球
    const moonGeometry = new THREE.SphereGeometry(CONSTS.MOON_RADIUS, CONSTS.SPHERE_SEGS, CONSTS.SPHERE_SEGS); 
    const moonTexture = textureLoader.load('./texture/moon.jpg');  
    const moonMaterial = new THREE.MeshPhongMaterial({ map: moonTexture }); //材质  
    moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.x = CONSTS.MOON_ORBIT_RADIUS;//月球相对月球轨道中心的偏移
    moonOrbit.add(moon);
    //添加星体到Objects里
    objects.push(sun,earth,moon);

    //4.动画效果：包括公转、自转等
    function render() { 
        const now = Date.now();
        scene.updateMatrixWorld(true);
        //处理聚焦物体
        if(focusedObject){
            //视角锁定
            const focusedPosition = new THREE.Vector3();
            focusedObject.getWorldPosition(focusedPosition);
            controls.target.copy(focusedPosition);
            //每个一定时间，更新视角跟随
            if (!isUserInteracting || now - lastUpdateTime > CONSTS.UPDATE_INTERVAL) {
                cameraOffset = currentCamera.position.clone().sub(focusedPosition);
                lastUpdateTime = now;
            }
            currentCamera.position.copy(focusedPosition).add(cameraOffset);
        }
        //最后还需要update
        controls.update();
        //处理自转
        if(CONFIGS.isRotation)
        {
            sun.rotation.y += CONSTS.SUN_ROTATION;
            earth.rotation.z += CONSTS.EARTH_ROTATION;
            moon.rotation.z += CONSTS.MOON_ROTATION;
        }
        //处理公转
        if(CONFIGS.isRevolution)
        { 
            earthOrbit.rotation.z += CONSTS.EARTH_REVOLUTION;
            moonOrbit.rotation.z += CONSTS.MOON_REVOLUTION;
        }

        renderer.render(scene,currentCamera);//每次更新页面都要刷新显示
        requestAnimationFrame( render);
    }
    requestAnimationFrame( render );

    // 5. 添加交互控制（鼠标拖拽缩放）
    controls = new THREE.OrbitControls(currentCamera, renderer.domElement);
    controls.enableDamping = true; // 启用阻尼感

    // 6. 添加其它函数
    //鼠标点击：判断是否和星球相交，如果相交触发事件
    function onMouseClick(event){
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(pointer, currentCamera);
        const intersects = raycaster.intersectObjects (objects);
        if ( intersects.length > 0 ) {//如果有点击到物体，只取第一个点击到的
            onIntersect(intersects[0].object);
        }
        console.log("点击！");  
    }
    //点击到星球：进行聚焦，并弹出换肤界面
    function onIntersect(object){
        console.log("onIntersect");
        //如果点击的是当前聚焦的对象：取消聚焦，恢复原本的聚焦目标
        if(focusedObject === object){
            controls.target.copy(originalTarget);
            focusedObject = null;
            controls.enableDamping = true; // 恢复阻尼效果
            return;
        }
        //否则，获取对象坐标和距离
        const objectPosition = new THREE.Vector3();
        object.getWorldPosition(objectPosition); 
        originalTarget.copy(controls.target);//需要保存原本的目标
        originalDistance = currentCamera.position.distanceTo(objectPosition);
        //计算位置偏移量（用于让相机保持与聚焦物体相对静止）
        cameraOffset = currentCamera.position.clone().sub(objectPosition);
        //设置聚焦目标为该对象
        focusedObject = object;
        controls.target.copy(objectPosition);
        //取消阻尼效果
        controls.enableDamping = false;
    }
    //控制器变化时，视角也要变化
    function onControlsChange(){
        if (focusedObject) {
            isUserInteracting = true;
            // 更新偏移向量
            const focusedPosition = new THREE.Vector3();
            focusedObject.getWorldPosition(focusedPosition);
            cameraOffset = currentCamera.position.clone().sub(focusedPosition);
            //缩放距离限制：不能过近也不能过远
            const dist = cameraOffset.length();
            if(dist < CONSTS.MIN_CAMERA_DISTANCE){
                cameraOffset.normalize().multiplyScalar(CONSTS.MIN_CAMERA_DISTANCE); //过近，限制为最近距离
                currentCamera.position.copy(focusedPosition).add(cameraOffset);
            }
            else if(dist > CONSTS.MAX_CAMERA_DISTANCE){
                cameraOffset.normalize().multiplyScalar(CONSTS.MAX_CAMERA_DISTANCE); //过远，限制为最远距离
                currentCamera.position.copy(focusedPosition).add(cameraOffset);
            }
        }
    }
    function onControlsEnd(){
        isUserInteracting = false;
    }
    //页面大小改变时：重新设置大小
    function onWindowResize() {
        currentCamera.aspect = window.innerWidth / window.innerHeight;
        currentCamera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    //按下按钮切换为俯视图
    function onVerticalCameraButtonClick(){ 
        currentCamera = verticalCamera;
        currentCamera.aspect = window.innerWidth / window.innerHeight;
        currentCamera.updateProjectionMatrix();
    }
    //按下按钮切换为侧视图
    function onHorizontalCameraButtonClick(){
        currentCamera = horizontalCamera;
        currentCamera.aspect = window.innerWidth / window.innerHeight;
        currentCamera.updateProjectionMatrix();
    }
    //按下按钮切换为自由视角
    function onFreeCameraButtonClick(){
        currentCamera = freeCamera;
        currentCamera.aspect = window.innerWidth / window.innerHeight;
        currentCamera.updateProjectionMatrix();
    }
    //自转的checkbox：开启/暂停自转
    function onRotationCheckboxClick(){
        if(CONFIGS.isRotation == true){
            CONFIGS.isRotation = false;
        }
        else{
            CONFIGS.isRotation = true;
        }
    }
    //公转的checkbox：开启/暂停公转
    function onRevolutionCheckboxClick(){
        if(CONFIGS.isRevolution == true){
            CONFIGS.isRevolution = false;
        }
        else{
            CONFIGS.isRevolution = true;
        }
    }
    // 7. 添加事件控制
    document.addEventListener('DOMContentLoaded', function(){ //绑定一些按钮

        window.addEventListener('resize',onWindowResize);
        
        document.querySelector("#button-vertical_camera").addEventListener('click', onVerticalCameraButtonClick);
        
        document.querySelector("#button-horizontal_camera").addEventListener('click',onHorizontalCameraButtonClick);
        
        document.querySelector("#button-free_camera").addEventListener('click',onFreeCameraButtonClick);

        document.querySelector("#checkbox-rotation").addEventListener('click',onRotationCheckboxClick);

        document.querySelector("#checkbox-revolution").addEventListener('click',onRevolutionCheckboxClick);

        document.addEventListener('click', onMouseClick);

        controls.addEventListener('change', onControlsChange);

        controls.addEventListener('end', onControlsEnd);
    })
}   

init();