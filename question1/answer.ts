interface Car {
    make: string;
    color: string;
    registration: string;
    owner: string;
  }
  
  interface Bicycle {
    make: string;
    color: string;
    owner: string;
  }
  
  const carpark: Car[] = [
   {
      make: "Toyota Yaris",
      color: "Red",
      registration: "231WD1234",
      owner: "Jane Smith",
   },
   {
      make: "Suzuki Swift",
      color: "Blue",
      registration: "241WD4321",
      owner: "Paul O Regan",
   },
   {
      make: "Ford Puma",
      color: "Blue",
      registration: "241WD1212",
      owner: "Eileen Silk",
   },
  ];
  
  const bicycleShed: Bicycle[] = [
   {
      make: "Revel Rascal XO",
      color: "Blue",
      owner: "Cindy Tamoka",
   },
   {
      make: "Yeti SB140 LR",
      color: "Red",
      owner: " ",
   },
  ];


function getMatches<T>(data: T[], criteria: (item: T) => boolean): T[] {
    return data.filter(criteria);
} //Generic search function

const blueBicycles = getMatches<Bicycle>(bicycleShed, (b) => b.color === "Blue"); //Get all Blue bikes
console.log(blueBicycles);

const redCars = getMatches<Car>(carpark, (b) => b.color == "Red"); //Get all Red cars
console.log(redCars);



//Old code  
/*function getCarMatches(data: Car[], criteria: (t: Car) => boolean): Car[] {
    return data.filter(criteria);
  }
  
  function getBicycleMatches(
    data: Bicycle[],
    criteria: (t: Bicycle) => boolean
  ): Bicycle[] {
    return data.filter(criteria);
  } */

