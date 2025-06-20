import utils from "../utils/utils"

// Fetch initial gazette dates and all ministry protobuf data
const fetchInitialGazetteData = async () => {
  try {
    const response = await fetch("/v1/entities/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: {
          major: "Organisation",
          minor: "minister"
        }
      })
    })

    // const responseForDepartment = await fetch("/v1/entities/search", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json"
    //   },
    //   body: JSON.stringify({
    //     kind: {
    //       major: "Organisation",
    //       minor: "department"
    //     }
    //   })
    // })
    
    const responseForPerson = await fetch("/v1/entities/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: {
          major: "Person",
          minor: "citizen"
        }
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }
    // if(!responseForDepartment.ok){
    //   throw new Error(`API error: ${responseForDepartment.statusText}`)
    // }
    if (!responseForPerson.ok) {
      throw new Error(`API error: ${responseForPerson.statusText}`)
    }

    const result = await response.json()
    // const resultForDepartment = await responseForDepartment.json()
    const resultForPerson = await responseForPerson.json()

    const datesList1 = result.body.map((item) => item.created?.split("T")[0]);
    const datesList2 = resultForPerson.body.map((item) => item.created?.split("T")[0]);
    // const datesList3 = resultForDepartment.body.map((item) => item.created?.split("T")[0]);

    const ministryIdList = result.body.map((item) => item.id);
    console.log('ministry Id LIst : ', ministryIdList);

    // console.log('date list 1',datesList1)
    // console.log('date list 2',datesList2)
    // console.log('date list 3',datesList3)

    const mergedDateList1 = datesList1.concat(datesList2).sort();
    // const mergedDateList2 = mergedDateList1.concat(datesList3).sort();
    const dates = Array.from(new Set(mergedDateList1))

    console.log(dates[0])

    var allResponses = [];

    const relationPromises = ministryIdList.map(async (ministryId) => {
      const response = await fetch(`/v1/entities/${ministryId}/relations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          relatedEntityId: "",
          startTime: `${dates[0]}T00:00:00Z`,
          endTime: "",
          id: "",
          name: "AS_DEPARTMENT"
        })
      });

      // console.log('inside ministry response ', response)

      if (!response.ok) {
        throw new Error(`Failed to fetch relations for ministry ${ministryId}`);
      }

      const jsonResponse = await response.json();
      console.log('all response json : ', allResponses)
      allResponses.push(jsonResponse.body);

      // return jsonResponse;
    });

    console.log('all response : ', allResponses)

    // Wait for all requests to complete
    // const allResponses = await Promise.all(relationPromises);
    // console.log('inside all ministry response ', allResponses)
    
    // // Combine all responses into a single list
    // const combinedRelations = allResponses.flatMap(response => response.body || []);

    // console.log('combined relations ', combinedRelations)
    
    return { dates, allMinistryData: result.body }
  } catch (error) {
    console.error("Error fetching initial gazette data from API:", error)
    return {
      dates: [],
      allMinistryData: [],
    }
  }
}

const fetchPresidentsData = async (governmentNodeId = "gov_01") => {
  try{
    const response = await fetch(`/v1/entities/${governmentNodeId}/allrelations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
    });

    const jsonResponse = await response.json();
    const presidentData = jsonResponse.filter(person => person.name == "AS_APPOINTED");

    return presidentData;

  }catch(e){
    console.log(`Error fetching presidents `,e.message);
    return [];
  }
}

const fetchActiveMinistries = async (selectedDate, allMinistryData, governmentNodeId = "gov_01") => {
  try {
    const response = await fetch(`/v1/entities/${governmentNodeId}/relations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        relatedEntityId: "",
        startTime: `${selectedDate.date}T00:00:00Z`,
        endTime: "",
        id: "",
        name: "AS_MINISTER"
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    const activeMinistryRelations = await response.json()

    // Extract the relatedEntityIds from the response
    const activeMinistryIds = activeMinistryRelations
      .filter(relation => relation.relatedEntityId)
      .map(relation => relation.relatedEntityId)

    console.log('Active ministry IDs:', activeMinistryIds)

    // Map active ministry IDs with the protobuf data to get ministry names
    const activeMinistries = allMinistryData
      .filter(ministry => activeMinistryIds.includes(ministry.id))
      .map(ministry => {
        let name = ministry.name

        try {
          const parsed = JSON.parse(ministry.name)
          if (parsed?.value) {
            name = utils.decodeHexString(parsed.value)
          }
        } catch (e) {
          // Use extractNameFromProtobuf as fallback
          name = utils.extractNameFromProtobuf(ministry.name) || ministry.name
        }

        return {
          name,
          id: ministry.id,
          type: "ministry",
          children: []
        }
      })

    console.log('Active ministries with names:', activeMinistries)

    return {
      name: "Government",
      children: activeMinistries,
      type: "root",
    }

  } catch (error) {
    console.error("Error fetching active ministries:", error)
    // Return empty tree structure on error
    return {
      name: "Government",
      children: [],
      type: "root",
    }
  }
}

const fetchAllPersons = async () => {
  try{
const response = await fetch("/v1/entities/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: {
          major: "Person",
          minor: "citizen"
        }
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    return response;
  } catch (error) {
    console.error("Error fetching person data from API:", error)
    return {
      dates: [],
      allMinistryData: [],
    }
  }
}

const fetchActiveRelationsForMinistry = async (selectedDate, ministryId, relationType) => {
  try {
    const response = await fetch(`/v1/entities/${ministryId}/relations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        relatedEntityId: "",
        startTime: `${selectedDate}T00:00:00Z`,
        endTime: "",
        id: "",
        name: relationType
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    return response;
    
  } catch (error) {
    console.error("Error fetching active ministries:", error)
  }
}

const fetchAllDepartments = async () => {
    // Fetch all department protobuf data
    const response = await fetch("/v1/entities/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: {
          major: "Organisation",
          minor: "department" 
        }
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    return response;
} 

const fetchAllMinistries = async () => {
    // Fetch all ministries protobuf data
    const response = await fetch("/v1/entities/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: {
          major: "Organisation",
          minor: "minister" 
        }
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    return response;
} 

export default {fetchInitialGazetteData, fetchActiveMinistries, fetchAllPersons, fetchActiveRelationsForMinistry,fetchAllMinistries, fetchAllDepartments, fetchPresidentsData};